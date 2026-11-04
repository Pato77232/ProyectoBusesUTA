const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { runMigration, testPool } = require('../../helpers/database');
const { rollbackBefore } = require('../../helpers/migration-target');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { createBookingsModule } = require('../../../src/modules/bookings');
const PgBookingRepository = require('../../../src/modules/bookings/infrastructure/pg-booking.repository');
const BookingsPaymentQueryAdapter = require('../../../src/modules/payments/infrastructure/bookings-payment-query-adapter');
const {
  summaryInput,
  summaryContext,
} = require('../../unit/bookings/helpers/booking-summary-fixtures');
const pass = (_req, _res, next) => next();
const auth = { authenticate: pass, authorize: () => pass, csrfProtection: pass };
const start = new Date('2026-11-03T14:00:00Z');
const before = new Date('2026-11-03T14:04:59.999Z');
const deadline = new Date('2026-11-03T14:05:00Z');
const after = new Date('2026-11-03T14:06:00Z');
let pool, repository, schema;
beforeAll(async () => {
  assertTestDatabase();
  runMigration();
  pool = testPool();
  repository = new PgBookingRepository({ pool });
  schema = 'receiptqa_' + randomUUID().replaceAll('-', '');
  // Fuente externa QA persistida; no es una API productiva de Payments ni una credencial Auth.
  await pool.query(`CREATE SCHEMA ${schema}; CREATE TABLE ${schema}.proofs(
    proof_id text PRIMARY KEY, booking_id text NOT NULL, cooperative_id text NOT NULL,
    status text NOT NULL, notification_status text NOT NULL, uploaded_at timestamptz NOT NULL)`);
});
beforeEach(async () => {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE booking_proof_receipt_results,booking_seat_allocations,bookings,booking_trip_locks',
  );
  await pool.query(`TRUNCATE ${schema}.proofs`);
});
afterAll(async () => {
  if (pool) {
    await pool.query(
      'TRUNCATE booking_proof_receipt_results,booking_seat_allocations,bookings,booking_trip_locks',
    );
    if (!/^receiptqa_[a-f0-9]{32}$/.test(schema)) throw new Error('Schema QA inválido.');
    await pool.query(`DROP SCHEMA ${schema} CASCADE`);
    await pool.end();
  }
});
async function create() {
  const context = {
    ...summaryContext(),
    bookingId: randomUUID(),
    ownerId: 'owner-qa',
    startedAt: new Date(start),
    proofWindowSeconds: 300,
  };
  const scope = { tripId: context.trip.tripId, cooperativeId: context.trip.cooperativeId };
  return repository.reserve(scope, async () => ({
    input: { ...summaryInput(), summaryAccepted: true },
    context,
  }));
}
function target(booking, proofId = 'proof-qa') {
  return {
    bookingId: booking.bookingId,
    cooperativeId: booking.summary.cooperativeId,
    paymentProofId: proofId,
  };
}
async function saveSource(input, notificationStatus = 'PENDING') {
  await pool.query(`INSERT INTO ${schema}.proofs VALUES($1,$2,$3,'UPLOADED',$4,$5)`, [
    input.paymentProofId,
    input.bookingId,
    input.cooperativeId,
    notificationStatus,
    start,
  ]);
}
async function source({ paymentProofId }) {
  const {
    rows: [row],
  } = await pool.query(
    `SELECT proof_id AS "paymentProofId",booking_id AS "bookingId",cooperative_id AS "cooperativeId",
    status,notification_status AS "notificationStatus",uploaded_at FROM ${schema}.proofs WHERE proof_id=$1`,
    [paymentProofId],
  );
  return row ? { ...row, uploadedAt: row.uploaded_at.toISOString() } : null;
}
function moduleAt(at = before, options = {}) {
  return createBookingsModule({
    pool,
    auth,
    env: { BOOKING_PROOF_WINDOW_SECONDS: '300' },
    clock: typeof at === 'function' ? at : () => new Date(at),
    ...options,
  });
}
function receiver(at = before, options = {}) {
  return moduleAt(at, options).createPaymentProofReceiver({ receiptSource: source });
}
async function state() {
  return {
    bookings: (await pool.query('SELECT * FROM bookings ORDER BY id')).rows,
    seats: (await pool.query('SELECT * FROM booking_seat_allocations ORDER BY booking_id,seat_id'))
      .rows,
    results: (
      await pool.query('SELECT * FROM booking_proof_receipt_results ORDER BY payment_proof_id')
    ).rows,
  };
}
async function setup() {
  const booking = await create();
  const input = target(booking);
  await saveSource(input);
  return { booking, input };
}
function lostCommitPool() {
  let lost = false;
  return {
    query: pool.query.bind(pool),
    connect: async () => {
      const client = await pool.connect();
      return {
        release: (error) => client.release(error),
        query: async (...args) => {
          const result = await client.query(...args);
          if (args[0] === 'COMMIT' && !lost) {
            lost = true;
            throw new Error('Respuesta perdida después de COMMIT real');
          }
          return result;
        },
      };
    },
  };
}
async function waitBlocked(pid, count) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const {
      rows: [row],
    } = await pool.query(
      `WITH RECURSIVE waiting(pid) AS (
        SELECT pid FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))
        UNION SELECT a.pid FROM pg_stat_activity a JOIN waiting w ON w.pid=ANY(pg_blocking_pids(a.pid))
      ) SELECT count(*)::int n FROM waiting`,
      [pid],
    );
    if (row.n >= count) return;
    await delay(10);
  }
  throw new Error('No se observó la barrera real de PostgreSQL.');
}
async function lockedRace(booking, first, second) {
  const holder = await pool.connect();
  const pending = [];
  let barrierFailure;
  try {
    await holder.query('BEGIN');
    const {
      rows: [row],
    } = await holder.query('SELECT pg_backend_pid() AS pid');
    await holder.query(
      'SELECT trip_id FROM booking_trip_locks WHERE cooperative_id=$1 AND trip_id=$2 FOR UPDATE',
      [booking.summary.cooperativeId, booking.summary.tripId],
    );
    pending.push(first());
    await waitBlocked(row.pid, 1);
    pending.push(second());
    await waitBlocked(row.pid, 2);
  } catch (error) {
    barrierFailure = error;
  } finally {
    await holder.query('COMMIT');
    holder.release();
  }
  // Finalizar todas las operaciones antes de dejar que la siguiente fixture limpie tablas.
  const results = await Promise.allSettled(pending);
  if (barrierFailure) throw barrierFailure;
  const rejected = results.find((result) => result.status === 'rejected');
  if (rejected) throw rejected.reason;
  return results.map((result) => result.value);
}

test('acepta y conserva dos asientos con resultado durable mínimo', async () => {
  const { input } = await setup();
  const result = await receiver().markPaymentProofReceived(input);
  expect(result).toEqual({ ...input, outcome: 'ACCEPTED', acceptedAt: before.toISOString() });
  const stored = await state();
  expect(stored.bookings[0].proof_reception_state).toBe('RECEIVED');
  expect(stored.bookings[0].accepted_proof_id).toBe(input.paymentProofId);
  expect(stored.seats).toHaveLength(2);
  expect(stored.seats.every((s) => s.active && s.status === 'RESERVED')).toBe(true);
  expect(stored.results).toHaveLength(1);
  expect(moduleAt().createPaymentProofReceiver({ receiptSource: source })).not.toHaveProperty(
    'expireBooking',
  );
});
test('reintento en otra instancia después del plazo no vuelve a consultar la fuente', async () => {
  const { input } = await setup();
  const accepted = await receiver().markPaymentProofReceived(input);
  const snapshot = await state();
  const unavailable = jest.fn(async () => {
    throw new Error('Fuente no disponible');
  });
  const clock = jest.fn(() => {
    throw new Error('No renovar reloj');
  });
  const retry = moduleAt(clock).createPaymentProofReceiver({ receiptSource: unavailable });
  expect(await retry.markPaymentProofReceived(input)).toEqual(accepted);
  expect(unavailable).not.toHaveBeenCalled();
  expect(clock).not.toHaveBeenCalled();
  expect(await state()).toEqual(snapshot);
});
test('dos recepciones iguales concurrentes recuperan una aceptación y fecha', async () => {
  const { input } = await setup();
  const results = await Promise.all([
    receiver().markPaymentProofReceived(input),
    receiver().markPaymentProofReceived(input),
  ]);
  expect(results[0]).toEqual(results[1]);
  expect((await state()).results).toHaveLength(1);
});
test('no acepta otro comprobante ni reutiliza el primero en otra reserva/cooperativa', async () => {
  const { input } = await setup();
  await receiver().markPaymentProofReceived(input);
  const snapshot = await state();
  const other = { ...input, paymentProofId: 'other-proof' };
  await saveSource(other);
  await expect(receiver().markPaymentProofReceived(other)).rejects.toMatchObject({
    code: 'BOOKING_RECEIPT_LINK_MISMATCH',
  });
  for (const change of [{ bookingId: 'other-booking' }, { cooperativeId: 'other-coop' }]) {
    await expect(
      receiver().markPaymentProofReceived({ ...input, ...change }),
    ).rejects.toMatchObject({ code: 'BOOKING_RECEIPT_LINK_MISMATCH' });
  }
  expect(await state()).toEqual(snapshot);
});
test.each(['absent', 'delivered', 'wrong-tenant', 'failure'])(
  'fuente %s no modifica ni autoriza compensación',
  async (kind) => {
    const { input } = await setup();
    const snapshot = await state();
    let actualSource = source;
    if (kind === 'absent') await pool.query(`DELETE FROM ${schema}.proofs`);
    if (kind === 'delivered')
      await pool.query(`UPDATE ${schema}.proofs SET notification_status='DELIVERED'`);
    if (kind === 'wrong-tenant')
      await pool.query(`UPDATE ${schema}.proofs SET cooperative_id='other'`);
    if (kind === 'failure')
      actualSource = async () => {
        throw new Error('SQL que no se expone');
      };
    const receive = moduleAt().createPaymentProofReceiver({ receiptSource: actualSource });
    await expect(receive.markPaymentProofReceived(input)).rejects.toMatchObject({
      code:
        kind === 'failure' ? 'BOOKING_LIFECYCLE_UNAVAILABLE' : 'BOOKING_RECEIPT_SOURCE_MISMATCH',
    });
    expect(await state()).toEqual(snapshot);
  },
);
test('el vencimiento exacto libera de forma persistida e idempotente y el lector lo conserva', async () => {
  const { booking } = await setup();
  expect(
    await moduleAt(before).maintenance.expireBooking({ bookingId: booking.bookingId }),
  ).toMatchObject({ outcome: 'NOT_DUE' });
  const expired = await moduleAt(deadline).maintenance.expireBooking({
    bookingId: booking.bookingId,
  });
  expect(expired).toEqual({
    outcome: 'EXPIRED',
    bookingId: booking.bookingId,
    expiredAt: deadline.toISOString(),
  });
  const snapshot = await state();
  expect(snapshot.seats.every((s) => !s.active && s.status === 'RESERVED')).toBe(true);
  expect(
    await moduleAt(() => {
      throw new Error('Reloj no disponible');
    }).maintenance.expireBooking({ bookingId: booking.bookingId }),
  ).toEqual(expired);
  expect(await state()).toEqual(snapshot);
  const adapter = new BookingsPaymentQueryAdapter({
    paymentQueries: moduleAt(after).paymentQueries,
  });
  const read = await adapter.findForPayment(
    { bookingId: booking.bookingId, purpose: 'UPLOAD_PROOF' },
    { userId: booking.ownerId, role: 'CUSTOMER', cooperativeId: null },
  );
  expect(read.status).toBe('EXPIRED');
  expect(read.acceptsPaymentProof).toBe(false);
});
test('dos expiradores concurrentes recuperan la misma fecha sin liberar dos veces', async () => {
  const { booking } = await setup();
  const results = await lockedRace(
    booking,
    () => moduleAt(deadline).maintenance.expireBooking({ bookingId: booking.bookingId }),
    () => moduleAt(after).maintenance.expireBooking({ bookingId: booking.bookingId }),
  );
  expect(results).toEqual([
    { outcome: 'EXPIRED', bookingId: booking.bookingId, expiredAt: deadline.toISOString() },
    { outcome: 'EXPIRED', bookingId: booking.bookingId, expiredAt: deadline.toISOString() },
  ]);
  const stored = await state();
  expect(stored.bookings[0].expired_at).toEqual(deadline);
  expect(stored.seats).toHaveLength(2);
  expect(stored.seats.every((seat) => !seat.active && seat.status === 'RESERVED')).toBe(true);
  expect(stored.results).toEqual([]);
});

test('aviso nuevo al límite rechaza y expira aunque el archivo se guardó antes', async () => {
  const { input } = await setup();
  const rejected = await receiver(deadline).markPaymentProofReceived(input);
  expect(rejected).toEqual({
    ...input,
    outcome: 'REJECTED_EXPIRED',
    rejectedAt: deadline.toISOString(),
  });
  const snapshot = await state();
  expect(snapshot.bookings[0].status).toBe('EXPIRED');
  expect(snapshot.seats.every((s) => !s.active)).toBe(true);
  expect(await receiver(after).markPaymentProofReceived(input)).toEqual(rejected);
  expect(await state()).toEqual(snapshot);
});
test('recepción ganadora conserva asientos frente a expiración concurrente real', async () => {
  const { booking, input } = await setup();
  const [receipt, expiration] = await lockedRace(
    booking,
    () => receiver(before).markPaymentProofReceived(input),
    () => moduleAt(after).maintenance.expireBooking({ bookingId: booking.bookingId }),
  );
  expect(receipt.outcome).toBe('ACCEPTED');
  expect(expiration.outcome).toBe('PROOF_RECEIVED');
  expect((await state()).seats.every((s) => s.active)).toBe(true);
});
test('expiración ganadora rechaza el aviso sin reactivar sus asientos', async () => {
  const { booking, input } = await setup();
  const [expiration, receipt] = await lockedRace(
    booking,
    () => moduleAt(deadline).maintenance.expireBooking({ bookingId: booking.bookingId }),
    () => receiver(after).markPaymentProofReceived(input),
  );
  expect(expiration.outcome).toBe('EXPIRED');
  expect(receipt.outcome).toBe('REJECTED_EXPIRED');
  expect((await state()).seats.every((s) => !s.active)).toBe(true);
});
test('el reloj se evalúa después de esperar el bloqueo', async () => {
  const { booking, input } = await setup();
  let now = before;
  const clock = jest.fn(() => new Date(now));
  const holder = await pool.connect();
  let pending;
  try {
    await holder.query('BEGIN');
    const {
      rows: [row],
    } = await holder.query('SELECT pg_backend_pid() pid');
    await holder.query(
      'SELECT trip_id FROM booking_trip_locks WHERE cooperative_id=$1 AND trip_id=$2 FOR UPDATE',
      [booking.summary.cooperativeId, booking.summary.tripId],
    );
    pending = moduleAt(clock)
      .createPaymentProofReceiver({ receiptSource: source })
      .markPaymentProofReceived(input);
    await waitBlocked(row.pid, 1);
    expect(clock).not.toHaveBeenCalled();
    now = deadline;
  } finally {
    await holder.query('COMMIT');
    holder.release();
  }
  expect((await pending).outcome).toBe('REJECTED_EXPIRED');
});
test.each([before, deadline])(
  'recupera resultado después de COMMIT real con respuesta perdida (%s)',
  async (at) => {
    const { input } = await setup();
    const receive = receiver(at, { pool: lostCommitPool() });
    await expect(receive.markPaymentProofReceived(input)).rejects.toMatchObject({
      code: 'BOOKING_LIFECYCLE_UNAVAILABLE',
    });
    const stored = await state();
    expect(stored.results).toHaveLength(1);
    const recovered = await moduleAt(after)
      .createPaymentProofReceiver({
        receiptSource: async () => {
          throw new Error('No consultar');
        },
      })
      .markPaymentProofReceived(input);
    expect(recovered.outcome).toBe(at === before ? 'ACCEPTED' : 'REJECTED_EXPIRED');
    expect(await state()).toEqual(stored);
  },
);
test('fallo al guardar resultado revierte también la primera recepción', async () => {
  const { input } = await setup();
  const snapshot = await state();
  await pool.query(`CREATE FUNCTION ${schema}.fail_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Fallo QA'; END $$;
    CREATE TRIGGER qa_fail_receipt BEFORE INSERT ON booking_proof_receipt_results FOR EACH ROW EXECUTE FUNCTION ${schema}.fail_receipt()`);
  try {
    await expect(receiver().markPaymentProofReceived(input)).rejects.toMatchObject({
      code: 'BOOKING_LIFECYCLE_UNAVAILABLE',
    });
    expect(await state()).toEqual(snapshot);
  } finally {
    await pool.query('DROP TRIGGER qa_fail_receipt ON booking_proof_receipt_results');
  }
});
test('fallo en segundo asiento revierte expiración, liberaciones y rechazo', async () => {
  const { input } = await setup();
  const snapshot = await state();
  await pool.query(`CREATE FUNCTION ${schema}.fail_release() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NOT NEW.active AND OLD.seat_id=(SELECT max(seat_id) FROM booking_seat_allocations WHERE booking_id=OLD.booking_id) THEN
      RAISE EXCEPTION 'Fallo en segundo asiento QA'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER qa_fail_release BEFORE UPDATE ON booking_seat_allocations FOR EACH ROW EXECUTE FUNCTION ${schema}.fail_release()`);
  try {
    await expect(receiver(deadline).markPaymentProofReceived(input)).rejects.toMatchObject({
      code: 'BOOKING_LIFECYCLE_UNAVAILABLE',
    });
    expect(await state()).toEqual(snapshot);
  } finally {
    await pool.query('DROP TRIGGER qa_fail_release ON booking_seat_allocations');
  }
});
test.each(['SOLD', 'inactive'])(
  'ocupación %s impide recepción y expiración sin efectos',
  async (kind) => {
    const { booking, input } = await setup();
    if (kind === 'SOLD')
      await pool.query(
        "UPDATE booking_seat_allocations SET status='SOLD' WHERE seat_id=(SELECT min(seat_id) FROM booking_seat_allocations)",
      );
    else
      await pool.query(
        'UPDATE booking_seat_allocations SET active=false WHERE seat_id=(SELECT min(seat_id) FROM booking_seat_allocations)',
      );
    const snapshot = await state();
    await expect(receiver().markPaymentProofReceived(input)).rejects.toMatchObject({
      code: 'BOOKING_DATA_INTEGRITY_ERROR',
    });
    await expect(
      moduleAt(deadline).maintenance.expireBooking({ bookingId: booking.bookingId }),
    ).rejects.toMatchObject({ code: 'BOOKING_DATA_INTEGRITY_ERROR' });
    expect(await state()).toEqual(snapshot);
  },
);
test('UNKNOWN no inventa ausencia ni permite liberar', async () => {
  const { booking } = await setup();
  const legacy = randomUUID();
  await pool.query(
    `INSERT INTO bookings(id,cooperative_id,trip_id,owner_id,from_position,to_position,status,summary,base_price_cents,discount_cents,total_price_cents,created_at,expires_at)
    SELECT $2,cooperative_id,trip_id,owner_id,from_position,to_position,status,summary,base_price_cents,discount_cents,total_price_cents,created_at,expires_at FROM bookings WHERE id=$1`,
    [booking.bookingId, legacy],
  );
  await pool.query(
    `INSERT INTO booking_seat_allocations SELECT $2,cooperative_id,trip_id,seat_id,from_position,to_position,status,active FROM booking_seat_allocations WHERE booking_id=$1`,
    [booking.bookingId, legacy],
  );
  await pool.query('DELETE FROM bookings WHERE id=$1', [booking.bookingId]);
  const input = { ...target(booking, 'legacy-proof'), bookingId: legacy };
  await saveSource(input);
  const snapshot = await state();
  await expect(receiver().markPaymentProofReceived(input)).rejects.toMatchObject({
    code: 'BOOKING_DATA_INTEGRITY_ERROR',
  });
  await expect(
    moduleAt(after).maintenance.expireBooking({ bookingId: legacy }),
  ).rejects.toMatchObject({ code: 'BOOKING_DATA_INTEGRITY_ERROR' });
  expect(await state()).toEqual(snapshot);
});
test('down protege evidencia y estados persistidos sin alterar historial', async () => {
  const { input } = await setup();
  await receiver().markPaymentProofReceived(input);
  await rollbackBefore(pool, '1794086400000-payment-proof-upload-provenance');
  expect(
    (await pool.query('SELECT name FROM pgmigrations ORDER BY id DESC LIMIT 1')).rows[0].name,
  ).toBe('1794086400000-payment-proof-upload-provenance');
  runMigration('down');
  runMigration('down');
  runMigration('down');
  try {
    const previous = (await pool.query('SELECT * FROM pgmigrations ORDER BY id')).rows;
    expect(previous.at(-1).name).toBe('1793910000000-booking-proof-receipts');
    const snapshot = await state();
    expect(() => runMigration('down')).toThrow();
    expect((await pool.query('SELECT * FROM pgmigrations ORDER BY id')).rows).toEqual(previous);
    expect(await state()).toEqual(snapshot);
    await expect(
      pool.query(
        "UPDATE booking_proof_receipt_results SET decided_at=decided_at+interval '1 second'",
      ),
    ).rejects.toMatchObject({ code: '23514' });
  } finally {
    runMigration();
  }
});
