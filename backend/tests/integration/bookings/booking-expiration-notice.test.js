const { randomUUID } = require('node:crypto');
const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const PgBookingRepository = require('../../../src/modules/bookings/infrastructure/pg-booking.repository');
const PgBookingLifecycleRepository = require('../../../src/modules/bookings/infrastructure/pg-booking-lifecycle.repository');
const { createNotificationsModule } = require('../../../src/modules/notifications');
const {
  summaryInput,
  summaryContext,
} = require('../../unit/bookings/helpers/booking-summary-fixtures');

const start = new Date('2026-11-03T14:00:00Z');
const after = new Date('2026-11-03T14:06:00Z');
const TABLES =
  'email_notifications,booking_guest_access_tokens,booking_proof_receipt_results,booking_seat_allocations,bookings,booking_trip_locks';
let pool, bookings, outbox;

async function create() {
  const context = {
    ...summaryContext(),
    bookingId: randomUUID(),
    ownerId: 'owner-qa',
    startedAt: new Date(start),
    proofWindowSeconds: 300,
  };
  const scope = { tripId: context.trip.tripId, cooperativeId: context.trip.cooperativeId };
  return bookings.reserve(scope, async () => ({
    input: { ...summaryInput(), summaryAccepted: true },
    context,
  }));
}

const lifecycle = (notificationOutbox = outbox) =>
  new PgBookingLifecycleRepository({ pool, notificationOutbox });
const notices = async () =>
  (await pool.query('SELECT kind, booking_id, cooperative_id, payload FROM email_notifications'))
    .rows;
const status = async (id) =>
  (await pool.query('SELECT status FROM bookings WHERE id = $1', [id])).rows[0].status;

beforeAll(() => {
  assertTestDatabase();
  runMigration();
  pool = testPool();
  bookings = new PgBookingRepository({ pool });
  outbox = createNotificationsModule({ clock: () => after }).outbox;
});
beforeEach(async () => {
  assertTestDatabase();
  await pool.query(`TRUNCATE ${TABLES}`);
});
afterAll(async () => {
  if (pool) {
    await pool.query(`TRUNCATE ${TABLES}`);
    await pool.end();
  }
});

test('vencer una reserva encola un único aviso de reserva vencida', async () => {
  const booking = await create();
  await lifecycle().expire({ bookingId: booking.bookingId }, () => after);
  expect(await status(booking.bookingId)).toBe('EXPIRED');
  expect(await notices()).toEqual([
    {
      kind: 'BOOKING_EXPIRED',
      booking_id: booking.bookingId,
      cooperative_id: booking.summary.cooperativeId,
      payload: {},
    },
  ]);
  await lifecycle().expire({ bookingId: booking.bookingId }, () => after);
  expect(await notices()).toHaveLength(1);
});

test('un comprobante que llega tarde vence la reserva y también avisa', async () => {
  const booking = await create();
  const result = await lifecycle().receive(
    {
      bookingId: booking.bookingId,
      cooperativeId: booking.summary.cooperativeId,
      paymentProofId: 'proof-tarde',
    },
    () => after,
  );
  expect(result.outcome).toBe('REJECTED_EXPIRED');
  expect(await status(booking.bookingId)).toBe('EXPIRED');
  expect((await notices()).map((n) => n.kind)).toEqual(['BOOKING_EXPIRED']);
});

test('una reserva aún vigente no vence ni avisa', async () => {
  const booking = await create();
  await lifecycle().expire({ bookingId: booking.bookingId }, () => start);
  expect(await status(booking.bookingId)).toBe('PENDING_PAYMENT');
  expect(await notices()).toEqual([]);
});

test('si encolar falla, el vencimiento se revierte y los asientos siguen reservados', async () => {
  const booking = await create();
  const failing = lifecycle({
    enqueueWith: async () => {
      throw new Error('outbox caído');
    },
  });
  await expect(failing.expire({ bookingId: booking.bookingId }, () => after)).rejects.toBeDefined();
  expect(await status(booking.bookingId)).toBe('PENDING_PAYMENT');
  const { rows } = await pool.query(
    'SELECT count(*)::int AS n FROM booking_seat_allocations WHERE booking_id = $1 AND active',
    [booking.bookingId],
  );
  expect(rows[0].n).toBeGreaterThan(0);
  expect(await notices()).toEqual([]);
});

test('sin outbox, Reservas vence como antes y no encola', async () => {
  const booking = await create();
  await new PgBookingLifecycleRepository({ pool }).expire(
    { bookingId: booking.bookingId },
    () => after,
  );
  expect(await status(booking.bookingId)).toBe('EXPIRED');
  expect(await notices()).toEqual([]);
});
