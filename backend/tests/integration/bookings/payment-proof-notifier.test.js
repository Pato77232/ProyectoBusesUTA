const { randomUUID } = require('node:crypto');
const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { createBookingsModule } = require('../../../src/modules/bookings');
const { createBookingPaymentProofNotifier } = require('../../../src/modules/payments');
const PgBookingRepository = require('../../../src/modules/bookings/infrastructure/pg-booking.repository');
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
let pool, schema;
// Fuente QA persistida: no es API productiva de Payments ni prueba de Auth de carga.
beforeAll(async () => {
  assertTestDatabase();
  runMigration();
  pool = testPool();
  schema = 'notifierqa_' + randomUUID().replaceAll('-', '');
  await pool.query(`CREATE SCHEMA ${schema}; CREATE TABLE ${schema}.proofs(
    proof_id text PRIMARY KEY, booking_id text NOT NULL, cooperative_id text NOT NULL,
    uploaded_at timestamptz NOT NULL)`);
});
beforeEach(async () => {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE booking_proof_receipt_results,booking_seat_allocations,bookings,booking_trip_locks',
  );
  await pool.query(`TRUNCATE ${schema}.proofs`);
});
afterAll(async () => {
  if (!pool) return;
  await pool.query(
    'TRUNCATE booking_proof_receipt_results,booking_seat_allocations,bookings,booking_trip_locks',
  );
  if (!/^notifierqa_[a-f0-9]{32}$/.test(schema)) throw new Error('Schema QA inválido');
  await pool.query(`DROP SCHEMA ${schema} CASCADE`);
  await pool.end();
});
async function setup() {
  const context = {
    ...summaryContext(),
    bookingId: randomUUID(),
    ownerId: 'owner-qa',
    startedAt: new Date(start),
    proofWindowSeconds: 300,
  };
  const booking = await new PgBookingRepository({ pool }).reserve(
    { tripId: context.trip.tripId, cooperativeId: context.trip.cooperativeId },
    async () => ({ input: { ...summaryInput(), summaryAccepted: true }, context }),
  );
  const input = {
    bookingId: booking.bookingId,
    cooperativeId: booking.summary.cooperativeId,
    paymentProofId: randomUUID(),
  };
  await pool.query(`INSERT INTO ${schema}.proofs VALUES($1,$2,$3,$4)`, [
    input.paymentProofId,
    input.bookingId,
    input.cooperativeId,
    start,
  ]);
  return input;
}
async function receiptSource({ paymentProofId }) {
  const {
    rows: [row],
  } = await pool.query(
    `SELECT proof_id AS "paymentProofId",booking_id AS "bookingId",cooperative_id AS "cooperativeId",uploaded_at
     FROM ${schema}.proofs WHERE proof_id=$1`,
    [paymentProofId],
  );
  return row
    ? {
        bookingId: row.bookingId,
        cooperativeId: row.cooperativeId,
        paymentProofId: row.paymentProofId,
        status: 'UPLOADED',
        notificationStatus: 'PENDING',
        uploadedAt: row.uploaded_at.toISOString(),
      }
    : null;
}
function bookings(at = before) {
  return createBookingsModule({
    pool,
    auth,
    env: { BOOKING_PROOF_WINDOW_SECONDS: '300' },
    clock: () => new Date(at),
  });
}
function notifier(at = before, source = receiptSource) {
  return createBookingPaymentProofNotifier({
    receiptReceiver: bookings(at).createPaymentProofReceiver({ receiptSource: source }),
  });
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
test('APIs públicas aceptan recepción real y conservan asientos tras el plazo', async () => {
  const input = await setup();
  const result = await notifier().markPaymentProofReceived(input);
  expect(result).toEqual({ ...input, outcome: 'ACCEPTED', acceptedAt: before.toISOString() });
  expect(
    await bookings(after).maintenance.expireBooking({ bookingId: input.bookingId }),
  ).toMatchObject({ outcome: 'PROOF_RECEIVED' });
  const stored = await state();
  expect(stored.bookings[0].proof_reception_state).toBe('RECEIVED');
  expect(stored.seats).toHaveLength(2);
  expect(stored.seats.every((seat) => seat.active && seat.status === 'RESERVED')).toBe(true);
  expect(stored.results).toHaveLength(1);
});
test('rechazo definitivo corresponde a expiración confirmada y repetible', async () => {
  const input = await setup();
  await expect(notifier(deadline).markPaymentProofReceived(input)).rejects.toMatchObject({
    code: 'PAYMENT_PROOF_UPLOAD_DEADLINE_EXPIRED',
    httpStatus: 409,
  });
  const stored = await state();
  expect(stored.bookings[0].status).toBe('EXPIRED');
  expect(stored.seats.every((seat) => !seat.active)).toBe(true);
  expect(stored.results).toHaveLength(1);
  expect(stored.results[0].outcome).toBe('REJECTED_EXPIRED');
  await expect(notifier(after).markPaymentProofReceived(input)).rejects.toMatchObject({
    code: 'PAYMENT_PROOF_UPLOAD_DEADLINE_EXPIRED',
  });
  expect(await state()).toEqual(stored);
});
test('respuesta perdida tras commit real conserva evidencia y recupera la aceptación anterior', async () => {
  const input = await setup();
  const real = bookings().createPaymentProofReceiver({ receiptSource });
  const lost = createBookingPaymentProofNotifier({
    receiptReceiver: {
      async markPaymentProofReceived(target) {
        await real.markPaymentProofReceived(target);
        throw new Error('Respuesta perdida tras commit');
      },
    },
  });
  await expect(lost.markPaymentProofReceived(input)).rejects.toMatchObject({
    code: 'BOOKING_NOTIFICATION_UNCERTAIN',
    httpStatus: 503,
  });
  const stored = await state();
  expect(stored.results).toHaveLength(1);
  expect(stored.bookings[0].proof_reception_state).toBe('RECEIVED');
  expect(stored.seats.every((seat) => seat.active)).toBe(true);
  const source = jest.fn(async () => {
    throw new Error('No consultar de nuevo');
  });
  expect(await notifier(after, source).markPaymentProofReceived(input)).toEqual({
    ...input,
    outcome: 'ACCEPTED',
    acceptedAt: before.toISOString(),
  });
  expect(source).not.toHaveBeenCalled();
  expect(await state()).toEqual(stored);
});
test('fuente incoherente no se convierte en vencimiento ni altera inventario', async () => {
  const input = await setup();
  await pool.query(`UPDATE ${schema}.proofs SET cooperative_id='other'`);
  const beforeState = await state();
  await expect(notifier().markPaymentProofReceived(input)).rejects.toMatchObject({
    code: 'BOOKING_NOTIFICATION_UNCERTAIN',
  });
  expect(await state()).toEqual(beforeState);
});
test('reutilizar clave con otra cooperativa no revela ni modifica el resultado anterior', async () => {
  const input = await setup();
  await notifier().markPaymentProofReceived(input);
  const beforeState = await state();
  await expect(
    notifier(after).markPaymentProofReceived({ ...input, cooperativeId: 'other' }),
  ).rejects.toMatchObject({ code: 'BOOKING_NOTIFICATION_UNCERTAIN' });
  expect(await state()).toEqual(beforeState);
});
