const { randomUUID } = require('node:crypto');
const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const PgBookingRepository = require('../../../src/modules/bookings/infrastructure/pg-booking.repository');
const findForPayment = require('../../../src/modules/bookings/application/find-for-payment.use-case');
const { createBookingsModule } = require('../../../src/modules/bookings');
const {
  summaryInput,
  summaryContext,
} = require('../../unit/bookings/helpers/booking-summary-fixtures');
const baseMigration = require('../../../migrations/1793145600000-create-bookings');
const migration = require('../../../migrations/1793740000000-booking-payment-read-context');

let pool;
let repository;
let read;
const scope = { tripId: 'viaje-prueba', cooperativeId: 'cooperativa-prueba' };
const principal = { userId: 'cliente-prueba', role: 'CUSTOMER', cooperativeId: null };
function prepared(changes = {}) {
  return {
    input: { ...summaryInput(), summaryAccepted: true },
    context: {
      ...summaryContext(),
      bookingId: randomUUID(),
      ownerId: principal.userId,
      startedAt: new Date('2026-11-02T14:00:00Z'),
      proofWindowSeconds: 300,
      ...changes,
    },
  };
}
async function create(changes) {
  return repository.reserve(scope, async () => prepared(changes));
}
function query(booking, purpose = 'UPLOAD_PROOF') {
  return { bookingId: booking.bookingId, purpose };
}
async function record(id) {
  return (await pool.query('SELECT * FROM bookings WHERE id=$1', [id])).rows[0];
}
async function sqlMigration(client, module, direction) {
  const statements = [];
  module[direction]({ sql: (sql) => statements.push(sql) });
  await client.query(statements.join(';\n'));
}
async function legacy(execute) {
  const schema = 'payment_' + randomUUID().replaceAll('-', '');
  const client = await pool.connect();
  try {
    await client.query('CREATE SCHEMA ' + schema);
    await client.query("SELECT set_config('search_path',$1,false)", [schema]);
    await sqlMigration(client, baseMigration, 'up');
    await client.query("INSERT INTO booking_trip_locks VALUES ('tenant','trip')");
    await client.query(`INSERT INTO bookings
      (id,cooperative_id,trip_id,owner_id,from_position,to_position,status,summary,
       base_price_cents,discount_cents,total_price_cents,created_at,expires_at)
      VALUES ('legacy','tenant','trip','owner',0,1,'PENDING_PAYMENT',
       '{"currency":"USD","totals":{"totalPriceCents":100}}',100,0,100,
       '2026-11-02T14:00:00Z','2026-11-02T14:05:00Z')`);
    await execute(client);
  } finally {
    await client.query('SET search_path TO public');
    await client.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE');
    client.release();
  }
}
beforeAll(() => {
  runMigration();
  pool = testPool();
  repository = new PgBookingRepository({ pool });
  read = findForPayment({ repository, clock: () => new Date('2026-11-02T14:01:00Z') });
});
beforeEach(async () => {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE booking_proof_receipt_results, booking_seat_allocations, bookings, booking_trip_locks',
  );
});
afterAll(async () => {
  if (pool) await pool.end();
});

test('creación atómica guarda inicio, duración y ausencia conocida sin defaults históricos', async () => {
  const booking = await create();
  const stored = await record(booking.bookingId);
  expect(stored.proof_reception_state).toBe('NOT_RECEIVED');
  expect(stored.proof_window_started_at.toISOString()).toBe(booking.createdAt);
  expect(stored.proof_window_seconds).toBe(300);
  expect(stored.accepted_proof_id).toBeNull();
  expect(stored.proof_received_at).toBeNull();
  const result = await read(query(booking), principal);
  expect(result).toMatchObject({
    totalPriceCents: 752,
    canUploadProof: true,
    ownerId: principal.userId,
  });
  expect(result.expiresAt).toBe(booking.expiresAt);
  expect(result).not.toHaveProperty('summary');
});

test('propiedad y tenant se filtran realmente en PostgreSQL', async () => {
  const booking = await create();
  expect(await read(query(booking), { ...principal, userId: 'otro' })).toBeNull();
  expect(await read({ bookingId: 'ausente', purpose: 'UPLOAD_PROOF' }, principal)).toBeNull();
  const clerk = { userId: 'oficinista', role: 'CLERK', cooperativeId: scope.cooperativeId };
  const result = await read(query(booking, 'REVIEW_PAYMENT'), clerk);
  expect(result.totalPriceCents).toBe(752);
  expect(result).not.toHaveProperty('ownerId');
  expect(
    await read(query(booking, 'REVIEW_PAYMENT'), { ...clerk, cooperativeId: 'otra' }),
  ).toBeNull();
});

test('API pública compuesta funciona sin catálogo ni acreditador y conserva router', async () => {
  const booking = await create();
  const auth = {
    authenticate() {},
    authorize() {
      return (_req, _res, next) => next();
    },
    csrfProtection() {},
  };
  const module = createBookingsModule({
    pool,
    auth,
    env: {},
    clock: () => new Date('2026-11-02T14:01:00Z'),
  });
  expect(module.router).toBeDefined();
  expect(Object.isFrozen(module.paymentQueries)).toBe(true);
  expect(await module.paymentQueries.findForPayment(query(booking), principal)).toMatchObject({
    totalPriceCents: 752,
    canUploadProof: true,
  });
});

test('antes, en y después del límite solo lee sin modificar filas u ocupaciones', async () => {
  const booking = await create();
  const before = await record(booking.bookingId);
  for (const [time, expected] of [
    ['2026-11-02T14:04:59.999Z', true],
    ['2026-11-02T14:05:00Z', false],
    ['2026-11-02T14:05:00.001Z', false],
  ]) {
    const lookup = findForPayment({ repository, clock: () => new Date(time) });
    expect((await lookup(query(booking), principal)).canUploadProof).toBe(expected);
  }
  expect(await record(booking.bookingId)).toEqual(before);
  expect((await repository.listEffectiveByTrip(scope)).map((value) => value.status)).toEqual([
    'RESERVED',
    'RESERVED',
  ]);
});

test('inicio y creación distintos se leen sin recalcular el inicio desde createdAt', async () => {
  const booking = await create();
  await pool.query("UPDATE bookings SET created_at = created_at - interval '1 hour' WHERE id=$1", [
    booking.bookingId,
  ]);
  const result = await read(query(booking), principal);
  expect(result.createdAt).toBe('2026-11-02T13:00:00.000Z');
  expect(result.proofWindowStartedAt).toBe('2026-11-02T14:00:00.000Z');
  expect(result.proofWindowSeconds).toBe(300);
});

test('la primera recepción comprobada se conserva y el lector no habilita nueva carga', async () => {
  const booking = await create();
  // Dato sembrado exclusivamente para verificar lectura/restricciones; no API de recepción.
  await pool.query(
    `UPDATE bookings SET proof_reception_state='RECEIVED',
    accepted_proof_id='comprobante', proof_received_at='2026-11-02T14:01:00Z' WHERE id=$1`,
    [booking.bookingId],
  );
  expect((await read(query(booking), principal)).canUploadProof).toBe(false);
  await expect(
    pool.query("UPDATE bookings SET accepted_proof_id='otro' WHERE id=$1", [booking.bookingId]),
  ).rejects.toMatchObject({ code: '23514' });
  await expect(
    pool.query(
      "UPDATE bookings SET proof_reception_state='NOT_RECEIVED', accepted_proof_id=NULL, proof_received_at=NULL WHERE id=$1",
      [booking.bookingId],
    ),
  ).rejects.toMatchObject({ code: '23514' });
});

test.each([
  'proof_window_seconds=180',
  "proof_window_started_at=proof_window_started_at+interval '1 second'",
  "expires_at=expires_at+interval '1 second'",
  "proof_reception_state='UNKNOWN',proof_window_started_at=NULL,proof_window_seconds=NULL",
  "accepted_proof_id='incompleto'",
  "proof_reception_state='RECEIVED',accepted_proof_id='x',proof_received_at=expires_at",
])('restricción impide alteración o recepción inválida: %s', async (assignment) => {
  const booking = await create();
  await expect(
    pool.query('UPDATE bookings SET ' + assignment + ' WHERE id=$1', [booking.bookingId]),
  ).rejects.toMatchObject({ code: '23514' });
});

test('fallo del segundo asiento revierte contexto, reserva, clave e inventario completos', async () => {
  await pool.query(`CREATE FUNCTION fail_payment_second_seat() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.seat_id='02' THEN RAISE EXCEPTION 'Fallo de prueba'; END IF; RETURN NEW; END; $$;
    CREATE TRIGGER fail_payment_second_seat BEFORE INSERT ON booking_seat_allocations
    FOR EACH ROW EXECUTE FUNCTION fail_payment_second_seat()`);
  try {
    await expect(
      repository.reserveOnce(
        {
          ownerId: principal.userId,
          requestKey: randomUUID(),
          requestFingerprint: 'a'.repeat(64),
        },
        async () => scope,
        async () => prepared(),
      ),
    ).rejects.toThrow('Fallo de prueba');
    expect((await pool.query('SELECT count(*)::int AS n FROM bookings')).rows[0].n).toBe(0);
    expect(
      (await pool.query('SELECT count(*)::int AS n FROM booking_seat_allocations')).rows[0].n,
    ).toBe(0);
    expect((await pool.query('SELECT count(*)::int AS n FROM booking_trip_locks')).rows[0].n).toBe(
      0,
    );
  } finally {
    await pool.query(
      'DROP TRIGGER fail_payment_second_seat ON booking_seat_allocations; DROP FUNCTION fail_payment_second_seat()',
    );
  }
});

test('reintento desde otra instancia conserva contexto original sin preparar otra compra', async () => {
  const operation = {
    ownerId: principal.userId,
    requestKey: randomUUID(),
    requestFingerprint: 'b'.repeat(64),
  };
  const first = await repository.reserveOnce(
    operation,
    async () => scope,
    async () => prepared(),
  );
  const before = await record(first.bookingId);
  const unavailable = async () => {
    throw new Error('No debe llamar proveedor');
  };
  const second = await new PgBookingRepository({ pool }).reserveOnce(
    operation,
    unavailable,
    unavailable,
  );
  expect(second).toEqual(first);
  expect(await record(first.bookingId)).toEqual(before);
});

test('migración no inventa datos históricos y down/up preserva filas de negocio', async () => {
  await legacy(async (client) => {
    const original = (await client.query('SELECT * FROM bookings')).rows[0];
    await sqlMigration(client, migration, 'up');
    const migrated = (await client.query('SELECT * FROM bookings')).rows[0];
    expect(migrated).toMatchObject(original);
    expect(migrated.proof_reception_state).toBe('UNKNOWN');
    expect(migrated.proof_window_started_at).toBeNull();
    expect(migrated.accepted_proof_id).toBeNull();
    const reader = findForPayment({
      repository: new PgBookingRepository({ pool: client }),
      clock: () => new Date(),
    });
    await expect(
      reader(
        { bookingId: 'legacy', purpose: 'UPLOAD_PROOF' },
        { userId: 'owner', role: 'CUSTOMER', cooperativeId: null },
      ),
    ).rejects.toMatchObject({ code: 'BOOKING_DATA_INTEGRITY_ERROR' });
    await sqlMigration(client, migration, 'down');
    expect((await client.query('SELECT * FROM bookings')).rows[0]).toEqual(original);
    await sqlMigration(client, migration, 'up');
    expect(
      (await client.query('SELECT proof_reception_state FROM bookings')).rows[0]
        .proof_reception_state,
    ).toBe('UNKNOWN');
  });
});

test('down incompatible falla sin eliminar columnas, hechos o protecciones', async () => {
  await legacy(async (client) => {
    await sqlMigration(client, migration, 'up');
    await client.query(`UPDATE bookings SET proof_window_started_at='2026-11-02T15:00:00Z',
      proof_window_seconds=300, expires_at='2026-11-02T15:05:00Z', proof_reception_state='NOT_RECEIVED'`);
    await expect(sqlMigration(client, migration, 'down')).rejects.toThrow('No se puede restaurar');
    const after = (await client.query('SELECT * FROM bookings')).rows[0];
    expect(after.proof_reception_state).toBe('NOT_RECEIVED');
    expect(after.expires_at.toISOString()).toBe('2026-11-02T15:05:00.000Z');
    await expect(
      client.query("UPDATE bookings SET expires_at=expires_at+interval '1 second'"),
    ).rejects.toMatchObject({ code: '23514' });
  });
});

test('proyecta sesión real de Auth y rechaza identidad de body o sesión revocada', async () => {
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const { createAuthModule } = require('../../../src/modules/auth');
  const userId = randomUUID();
  const sid = randomUUID();
  const env = {
    JWT_SECRET: 'secreto-ficticio-para-lector-pagos-2026-123456',
    JWT_EXPIRES_IN: '30m',
  };
  await pool.query(
    "INSERT INTO users(id,email,password_hash,role) VALUES($1,$2,'hash-ficticio','CUSTOMER')",
    [userId, userId + '@example.ec'],
  );
  await pool.query(
    "INSERT INTO auth_sessions(id,user_id,expires_at) VALUES($1,$2,CURRENT_TIMESTAMP+interval '1 hour')",
    [sid, userId],
  );
  const booking = await create({ ownerId: userId });
  const auth = await createAuthModule({ pool, env });
  const module = createBookingsModule({
    pool,
    auth,
    env,
    clock: () => new Date('2026-11-02T14:01:00Z'),
  });
  const app = express();
  app.use(express.json());
  // Ruta exclusiva del harness QA: el lector no agrega un endpoint productivo.
  app.post('/qa-read', auth.authenticate, async (req, res, next) => {
    try {
      const result = await module.paymentQueries.findForPayment(
        {
          bookingId: req.body.bookingId,
          purpose: 'UPLOAD_PROOF',
        },
        {
          userId: req.auth.user.id,
          role: req.auth.user.role,
          cooperativeId: req.auth.user.cooperative_id,
        },
      );
      res.status(result === null ? 404 : 200).json({ booking: result });
    } catch (error) {
      next(error);
    }
  });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const token = jwt.sign(
    { sub: userId, sid, role: 'CUSTOMER', cooperative_id: null },
    env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '30m' },
  );
  const url = 'http://127.0.0.1:' + server.address().port + '/qa-read';
  const request = (withToken, body) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(withToken ? { cookie: 'access_token=' + token } : {}),
      },
      body: JSON.stringify(body),
    });
  try {
    expect(
      (await request(false, { bookingId: booking.bookingId, userId, role: 'CUSTOMER' })).status,
    ).toBe(401);
    const response = await request(true, {
      bookingId: booking.bookingId,
      userId: 'otro',
      cooperativeId: 'otra',
    });
    expect(response.status).toBe(200);
    expect((await response.json()).booking.ownerId).toBe(userId);
    await pool.query('UPDATE bookings SET owner_id=$1 WHERE id=$2', [
      'otro-comprador',
      booking.bookingId,
    ]);
    expect(
      (await request(true, { bookingId: booking.bookingId, userId: 'otro-comprador' })).status,
    ).toBe(404);
    await pool.query('UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE id=$1', [sid]);
    expect((await request(true, { bookingId: booking.bookingId })).status).toBe(401);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await pool.query('DELETE FROM auth_sessions WHERE id=$1', [sid]);
    await pool.query('DELETE FROM users WHERE id=$1', [userId]);
  }
});

test('captura el plazo antes de esperar lectura de ocupaciones aunque muten el contexto preparado', async () => {
  const data = prepared();
  const wrapped = new PgBookingRepository({
    pool: {
      connect: async () => {
        const client = await pool.connect();
        return {
          release: (...args) => client.release(...args),
          query: (sql, args) => {
            if (sql.includes('FROM booking_seat_allocations WHERE')) {
              data.context.startedAt.setTime(Date.parse('2027-01-01T00:00:00Z'));
              data.context.proofWindowSeconds = 180;
            }
            return client.query(sql, args);
          },
        };
      },
    },
  });
  const booking = await wrapped.reserve(scope, async () => data);
  const saved = await record(booking.bookingId);
  expect(saved.proof_window_started_at.toISOString()).toBe('2026-11-02T14:00:00.000Z');
  expect(saved.proof_window_seconds).toBe(300);
  expect(saved.expires_at.toISOString()).toBe('2026-11-02T14:05:00.000Z');
});
