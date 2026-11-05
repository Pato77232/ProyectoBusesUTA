const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { createBookingTicketQueries } = require('../../../src/modules/bookings');
const PgBookingSaleConfirmer = require('../../../src/modules/bookings/infrastructure/pg-booking-sale-confirmer');
const { OWNER_ID, soldRowWithTrip } = require('../../helpers/sold-booking-ticket-trip');

const bookingId = 'venta-opaca/qa';
const target = { bookingId, ownerId: OWNER_ID };
const soldAt = new Date('2026-11-04T14:02:00.000Z');
let pool, queries;

async function clear() {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE booking_guest_access_tokens,booking_benefit_reviews,booking_proof_receipt_results,booking_seat_allocations,bookings,booking_trip_locks CASCADE',
  );
}

async function confirm() {
  const confirmer = new PgBookingSaleConfirmer({ pool, clock: () => soldAt });
  await expect(
    confirmer.confirmSale({
      bookingId,
      cooperativeId: 'coop-ticket',
      paymentProofId: 'proof-ticket',
    }),
  ).resolves.toBe(true);
}

async function storedState() {
  return {
    bookings: (await pool.query('SELECT * FROM bookings ORDER BY id')).rows,
    seats: (await pool.query('SELECT * FROM booking_seat_allocations ORDER BY booking_id,seat_id'))
      .rows,
  };
}

beforeAll(() => {
  assertTestDatabase();
  runMigration();
  pool = testPool();
  queries = createBookingTicketQueries({ pool });
});

beforeEach(async () => {
  await clear();
  const row = soldRowWithTrip();
  await pool.query("INSERT INTO booking_trip_locks VALUES('coop-ticket','trip-ticket')");
  await pool.query(
    `INSERT INTO bookings(id,cooperative_id,trip_id,owner_id,from_position,to_position,status,summary,
    base_price_cents,discount_cents,total_price_cents,created_at,expires_at,
    proof_window_started_at,proof_window_seconds,proof_reception_state,accepted_proof_id,proof_received_at)
    VALUES($1,'coop-ticket','trip-ticket',$2,0,1,'PENDING_PAYMENT',$3,
    1000,0,1000,'2026-11-04T14:00:00Z','2026-11-04T14:05:00Z',
    '2026-11-04T14:00:00Z',300,'RECEIVED','proof-ticket','2026-11-04T14:01:00Z')`,
    [bookingId, OWNER_ID, row.summary],
  );
  for (const p of row.summary.passengers)
    await pool.query(
      `INSERT INTO booking_seat_allocations VALUES($1,'coop-ticket','trip-ticket',$2,0,1,'RESERVED',true)`,
      [bookingId, p.seatId],
    );
});

afterAll(async () => {
  if (pool) {
    await clear();
    await pool.end();
  }
});

test('el propietario lee su venta confirmada con el tramo congelado y sin efectos', async () => {
  expect(await queries.findSoldForOwner(target)).toBeNull();
  await confirm();
  const before = await storedState();
  const result = await queries.findSoldForOwner(target);
  expect(result).toMatchObject({
    bookingId,
    cooperativeId: 'coop-ticket',
    soldAt: soldAt.toISOString(),
    totalPriceCents: 1000,
    trip: {
      departureDate: '2026-11-10',
      origin: { locationKey: 'Ambato', departureAt: '2026-11-10T08:00:00-05:00' },
      destination: { locationKey: 'Latacunga', arrivalAt: '2026-11-10T08:50:00-05:00' },
    },
  });
  expect(result.passengers.map((p) => p.totalPriceCents)).toEqual([600, 400]);
  expect(JSON.stringify(result)).not.toMatch(
    /propietario-privado|birthDate|accreditation|privateField|proof-ticket/,
  );
  expect(await queries.findSoldForOwner(target)).toEqual(result);
  expect(await storedState()).toEqual(before);
});

test('otro propietario y una reserva ausente reciben null indistinguible', async () => {
  await confirm();
  expect(await queries.findSoldForOwner({ ...target, ownerId: 'otro-cliente' })).toBeNull();
  expect(await queries.findSoldForOwner({ ...target, bookingId: 'ausente' })).toBeNull();
});

test('la lectura por cooperativa de BOOK-09 no cambia su forma', async () => {
  await confirm();
  const sale = await queries.findSoldForTicket({ bookingId, cooperativeId: 'coop-ticket' });
  expect(sale).not.toHaveProperty('trip');
  expect(sale).not.toHaveProperty('ownerId');
});
