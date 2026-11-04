const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { createBookingsModule } = require('../../../src/modules/bookings');
const PgBookingRepository = require('../../../src/modules/bookings/infrastructure/pg-booking.repository');
const {
  summaryInput,
  summaryContext,
} = require('../../unit/bookings/helpers/booking-summary-fixtures');
const pass = (_req, _res, next) => next();
const auth = { authenticate: pass, authorize: () => pass, csrfProtection: pass };
const start = new Date('2026-11-04T14:00:00.000Z');
const received = new Date('2026-11-04T14:01:00.000Z');
const now = new Date('2026-11-04T15:00:00.000Z');
let pool, schema;
function moduleWith(options = {}) {
  return createBookingsModule({
    pool,
    auth,
    env: { BOOKING_PROOF_WINDOW_SECONDS: '300' },
    clock: () => now,
    ...options,
  });
}
// Puerto QA persistido, no API productiva de Payments ni prueba de permisos Auth.
async function approvalSource(target) {
  const { rows } = await pool.query(
    `SELECT payload FROM ${schema}.intents WHERE
    payload->>'bookingId'=$1 AND payload->>'cooperativeId'=$2 AND payload->>'paymentProofId'=$3`,
    [target.bookingId, target.cooperativeId, target.paymentProofId],
  );
  return rows[0]?.payload ?? null;
}
function confirmer(options = {}) {
  return moduleWith(options).createPaymentSaleConfirmer({ approvalSource });
}
async function clear() {
  await pool.query(
    'TRUNCATE booking_proof_receipt_results,booking_seat_allocations,bookings,booking_trip_locks',
  );
  await pool.query(`TRUNCATE ${schema}.intents`);
}
beforeAll(async () => {
  assertTestDatabase();
  runMigration();
  pool = testPool();
  schema = 'saleapiqa_' + randomUUID().replaceAll('-', '');
  await pool.query(
    `CREATE SCHEMA ${schema}; CREATE TABLE ${schema}.intents(id text PRIMARY KEY,payload jsonb NOT NULL)`,
  );
});
beforeEach(clear);
afterAll(async () => {
  if (pool) {
    await clear();
    if (!/^saleapiqa_[a-f0-9]{32}$/.test(schema)) throw new Error('Esquema QA inválido.');
    await pool.query(`DROP SCHEMA ${schema} CASCADE`);
    await pool.end();
  }
});
async function fixture(accept = true) {
  const context = {
    ...summaryContext(),
    bookingId: randomUUID(),
    ownerId: 'qa-owner',
    startedAt: start,
    proofWindowSeconds: 300,
  };
  const booking = await new PgBookingRepository({ pool }).reserve(
    { tripId: context.trip.tripId, cooperativeId: context.trip.cooperativeId },
    async () => ({ input: { ...summaryInput(), summaryAccepted: true }, context }),
  );
  const target = {
    bookingId: booking.bookingId,
    cooperativeId: context.trip.cooperativeId,
    paymentProofId: randomUUID(),
  };
  if (accept)
    await moduleWith({ clock: () => received })
      .createPaymentProofReceiver({
        receiptSource: async () => ({
          ...target,
          status: 'UPLOADED',
          notificationStatus: 'PENDING',
          uploadedAt: start.toISOString(),
        }),
      })
      .markPaymentProofReceived(target);
  const intent = {
    ...target,
    proofVersion: 1,
    requestedBy: 'qa-clerk',
    requestedAt: '2026-11-04T14:02:00.000Z',
  };
  await pool.query(`INSERT INTO ${schema}.intents VALUES($1,$2)`, [target.paymentProofId, intent]);
  return { target, intent };
}
async function state() {
  return {
    bookings: (await pool.query('SELECT * FROM bookings ORDER BY id')).rows,
    seats: (await pool.query('SELECT * FROM booking_seat_allocations ORDER BY booking_id,seat_id'))
      .rows,
    receipts: (
      await pool.query('SELECT * FROM booking_proof_receipt_results ORDER BY payment_proof_id')
    ).rows,
  };
}
async function waitBlocked(pid, count) {
  for (let i = 0; i < 300; i++) {
    const {
      rows: [row],
    } = await pool.query(
      `WITH RECURSIVE waiting(pid) AS (
      SELECT pid FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))
      UNION SELECT a.pid FROM pg_stat_activity a JOIN waiting w ON w.pid=ANY(pg_blocking_pids(a.pid)))
      SELECT count(*)::int n FROM waiting`,
      [pid],
    );
    if (row.n >= count) return;
    await delay(10);
  }
  throw new Error('No se observó barrera PostgreSQL real.');
}

test('API pública confirma y devuelve solo resultado durable, con total persistido y asientos SOLD', async () => {
  const { target, intent } = await fixture();
  const api = confirmer();
  expect(Object.isFrozen(api)).toBe(true);
  const result = await api.confirmSale(target);
  expect(result).toEqual({
    ...intent,
    currency: 'USD',
    totalPriceCents: 752,
    confirmedAt: now.toISOString(),
  });
  const current = await state();
  expect(current.bookings[0].status).toBe('CONFIRMED');
  expect(current.seats).toHaveLength(2);
  expect(current.seats.every((s) => s.status === 'SOLD' && s.active)).toBe(true);
  expect(result).not.toHaveProperty('passengers');
  expect(result).not.toHaveProperty('ownerId');
});

test('reintento por otra instancia devuelve fecha y actor originales sin reloj nuevo', async () => {
  const { target } = await fixture();
  const first = await confirmer().confirmSale(target);
  const before = await state();
  const clock = jest.fn(() => {
    throw new Error('No reevaluar fecha');
  });
  expect(await confirmer({ clock }).confirmSale(target)).toEqual(first);
  expect(clock).not.toHaveBeenCalled();
  expect(await state()).toEqual(before);
});

test('fábrica sin fuente obligatoria no crea confirmador simulado', () => {
  const bookings = moduleWith();
  expect(() => bookings.createPaymentSaleConfirmer()).toThrow(TypeError);
  expect(() => bookings.createPaymentSaleConfirmer({ approvalSource: {} })).toThrow(TypeError);
});

test('intención ausente no escribe venta ni libera reserva en revisión', async () => {
  const { target } = await fixture();
  await pool.query(`DELETE FROM ${schema}.intents`);
  const before = await state();
  await expect(confirmer().confirmSale(target)).rejects.toMatchObject({
    code: 'BOOKING_SALE_UNAVAILABLE',
  });
  expect(await state()).toEqual(before);
});

test('fuente sin versión acreditada conserva el histórico sin asignarle versión 1', async () => {
  const { target, intent } = await fixture();
  await pool.query(`UPDATE ${schema}.intents SET payload=$1`, [{ ...intent, proofVersion: null }]);
  const before = await state();
  await expect(confirmer().confirmSale(target)).rejects.toMatchObject({
    code: 'BOOKING_SALE_DATA_INTEGRITY_ERROR',
  });
  expect(await state()).toEqual(before);
  expect(before.bookings[0].sale_proof_version).toBeNull();
});

test('fuente caída incluso tras venta deja incertidumbre hasta recuperarla, sin duplicar', async () => {
  const { target } = await fixture();
  const first = await confirmer().confirmSale(target);
  const before = await state();
  const unavailable = moduleWith().createPaymentSaleConfirmer({
    approvalSource: async () => {
      throw new Error('SQL privado');
    },
  });
  await expect(unavailable.confirmSale(target)).rejects.toMatchObject({
    code: 'BOOKING_SALE_UNAVAILABLE',
  });
  expect(await state()).toEqual(before);
  expect(await confirmer().confirmSale(target)).toEqual(first);
  expect(await state()).toEqual(before);
});

test('campos extra de cliente y vínculos ajenos no autorizan una venta', async () => {
  const { target, intent } = await fixture();
  const before = await state();
  await expect(confirmer().confirmSale({ ...target, proofVersion: 1 })).rejects.toMatchObject({
    code: 'BOOKING_VALIDATION_ERROR',
  });
  const wrong = moduleWith().createPaymentSaleConfirmer({
    approvalSource: async () => ({ ...intent, cooperativeId: 'otra' }),
  });
  await expect(wrong.confirmSale(target)).rejects.toMatchObject({
    code: 'BOOKING_SALE_LINK_MISMATCH',
  });
  expect(await state()).toEqual(before);
});

test('si el proveedor cambia versión tras vender, no lo confunde con el mismo intento', async () => {
  const { target, intent } = await fixture();
  await confirmer().confirmSale(target);
  const before = await state();
  await pool.query(`UPDATE ${schema}.intents SET payload=$1`, [{ ...intent, proofVersion: 2 }]);
  await expect(confirmer().confirmSale(target)).rejects.toMatchObject({
    code: 'BOOKING_SALE_VERSION_MISMATCH',
  });
  expect(await state()).toEqual(before);
});

test('dos llamadas públicas bajo barrera real producen el mismo resultado', async () => {
  const { target } = await fixture();
  const holder = await pool.connect();
  const pending = [];
  let failure;
  try {
    await holder.query('BEGIN');
    const {
      rows: [{ pid }],
    } = await holder.query('SELECT pg_backend_pid() pid');
    await holder.query(
      'SELECT trip_id FROM booking_trip_locks WHERE cooperative_id=$1 AND trip_id=$2 FOR UPDATE',
      [target.cooperativeId, 'viaje-prueba'],
    );
    pending.push(confirmer().confirmSale(target));
    await waitBlocked(pid, 1);
    pending.push(confirmer().confirmSale(target));
    await waitBlocked(pid, 2);
  } catch (e) {
    failure = e;
  } finally {
    await holder.query('COMMIT');
    holder.release();
  }
  const results = await Promise.allSettled(pending);
  if (failure) throw failure;
  for (const result of results) if (result.status === 'rejected') throw result.reason;
  expect(results[0].value).toEqual(results[1].value);
  expect((await state()).seats.every((s) => s.status === 'SOLD' && s.active)).toBe(true);
});

test('COMMIT perdido por API se clasifica incierto y se recupera con otra instancia', async () => {
  const { target } = await fixture();
  let lost = false;
  const uncertainPool = {
    query: pool.query.bind(pool),
    connect: async () => {
      const client = await pool.connect();
      return {
        release: (e) => client.release(e),
        query: async (...args) => {
          const result = await client.query(...args);
          if (args[0] === 'COMMIT' && !lost) {
            lost = true;
            throw new Error('COMMIT perdido');
          }
          return result;
        },
      };
    },
  };
  await expect(confirmer({ pool: uncertainPool }).confirmSale(target)).rejects.toMatchObject({
    code: 'BOOKING_SALE_UNAVAILABLE',
  });
  const before = await state();
  expect(before.bookings[0].status).toBe('CONFIRMED');
  expect(await confirmer().confirmSale(target)).toMatchObject({
    proofVersion: 1,
    confirmedAt: now.toISOString(),
  });
  expect(await state()).toEqual(before);
});

test('sin recepción aceptada no vende aunque exista una intención', async () => {
  const { target } = await fixture(false);
  const before = await state();
  await expect(confirmer().confirmSale(target)).rejects.toMatchObject({
    code: 'BOOKING_SALE_NOT_CONFIRMABLE',
  });
  expect(await state()).toEqual(before);
});
