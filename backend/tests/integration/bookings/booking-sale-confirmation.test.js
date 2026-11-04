const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const PgBookingSaleConfirmer = require('../../../src/modules/bookings/infrastructure/pg-booking-sale-confirmer');

let pool;
const now = new Date('2026-11-04T15:00:00.000Z');

beforeAll(() => {
  runMigration();
  pool = testPool();
});

beforeEach(async () => {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE booking_proof_receipt_results, booking_seat_allocations, bookings, booking_trip_locks',
  );
  await pool.query("INSERT INTO booking_trip_locks VALUES('coop-sale','trip-sale')");
  await pool.query(
    `INSERT INTO bookings(
      id,cooperative_id,trip_id,owner_id,from_position,to_position,status,summary,
      base_price_cents,discount_cents,total_price_cents,created_at,expires_at,
      proof_window_started_at,proof_window_seconds,proof_reception_state,accepted_proof_id,proof_received_at
    ) VALUES(
      'booking-sale','coop-sale','trip-sale','owner-sale',0,1,'PENDING_PAYMENT',$1,
      1000,0,1000,$2,$3,$2,300,'RECEIVED','proof-sale',$4
    )`,
    [
      { passengers: [{ seatId: 'seat-sale' }], totalPriceCents: 1000 },
      now,
      new Date(now.getTime() + 300000),
      new Date(now.getTime() + 60000),
    ],
  );
  await pool.query(
    `INSERT INTO booking_seat_allocations
      (booking_id,cooperative_id,trip_id,seat_id,from_position,to_position,status,active)
      VALUES('booking-sale','coop-sale','trip-sale','seat-sale',0,1,'RESERVED',true)`,
  );
});

afterAll(async () => {
  await pool?.end();
});

test('confirma venta contra PostgreSQL y repite la misma clave sin duplicar efectos', async () => {
  const confirmer = new PgBookingSaleConfirmer({ pool, clock: () => now });
  await expect(
    confirmer.confirmSale({
      bookingId: 'booking-sale',
      cooperativeId: 'coop-sale',
      paymentProofId: 'proof-sale',
    }),
  ).resolves.toBe(true);
  await expect(
    confirmer.confirmSale({
      bookingId: 'booking-sale',
      cooperativeId: 'coop-sale',
      paymentProofId: 'proof-sale',
    }),
  ).resolves.toBe(true);
  expect((await pool.query('SELECT status,sold_at FROM bookings')).rows[0].status).toBe('SOLD');
  expect((await pool.query('SELECT status,active FROM booking_seat_allocations')).rows).toEqual([
    { status: 'SOLD', active: true },
  ]);
});

test('rechaza un comprobante distinto sin cambiar la reserva', async () => {
  const confirmer = new PgBookingSaleConfirmer({ pool, clock: () => now });
  await expect(
    confirmer.confirmSale({
      bookingId: 'booking-sale',
      cooperativeId: 'coop-sale',
      paymentProofId: 'other-proof',
    }),
  ).rejects.toMatchObject({ code: 'BOOKING_SALE_REJECTED' });
  expect((await pool.query('SELECT status FROM bookings')).rows[0].status).toBe('PENDING_PAYMENT');
});

test('rechaza con motivo, conserva actor y libera el asiento', async () => {
  const confirmer = new PgBookingSaleConfirmer({ pool, clock: () => now });
  await expect(
    confirmer.rejectSale({
      bookingId: 'booking-sale',
      cooperativeId: 'coop-sale',
      paymentProofId: 'proof-sale',
      rejectedBy: 'clerk-sale',
      justification: 'El comprobante no corresponde al titular.',
    }),
  ).resolves.toBe(true);
  expect(
    (await pool.query('SELECT status,rejected_by,rejection_justification FROM bookings')).rows[0],
  ).toMatchObject({
    status: 'REJECTED',
    rejected_by: 'clerk-sale',
    rejection_justification: 'El comprobante no corresponde al titular.',
  });
  expect((await pool.query('SELECT active FROM booking_seat_allocations')).rows[0].active).toBe(
    false,
  );
});
