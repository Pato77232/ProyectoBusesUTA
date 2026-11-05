const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { createBookingTicketQueries } = require('../../../src/modules/bookings');
const PgBookingSaleConfirmer = require('../../../src/modules/bookings/infrastructure/pg-booking-sale-confirmer');
const soldRow = require('../../helpers/sold-booking-ticket');
const target = { bookingId: 'venta-opaca/qa', cooperativeId: 'coop-ticket' };
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
  await expect(confirmer.confirmSale({ ...target, paymentProofId: 'proof-ticket' })).resolves.toBe(
    true,
  );
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
  const row = soldRow();
  await pool.query("INSERT INTO booking_trip_locks VALUES('coop-ticket','trip-ticket')");
  await pool.query(
    `INSERT INTO bookings(id,cooperative_id,trip_id,owner_id,from_position,to_position,status,summary,
    base_price_cents,discount_cents,total_price_cents,created_at,expires_at,
    proof_window_started_at,proof_window_seconds,proof_reception_state,accepted_proof_id,proof_received_at)
    VALUES($1,'coop-ticket','trip-ticket','owner-ticket',0,1,'PENDING_PAYMENT',$2,
    1000,0,1000,'2026-11-04T14:00:00Z','2026-11-04T14:05:00Z',
    '2026-11-04T14:00:00Z',300,'RECEIVED','proof-ticket','2026-11-04T14:01:00Z')`,
    [target.bookingId, row.summary],
  );
  for (const p of row.summary.passengers)
    await pool.query(
      `INSERT INTO booking_seat_allocations VALUES($1,'coop-ticket','trip-ticket',$2,0,1,'RESERVED',true)`,
      [target.bookingId, p.seatId],
    );
});
afterAll(async () => {
  if (pool) {
    await clear();
    await pool.end();
  }
});
test('venta persistida con confirmador real habilita lectura privada repetible sin efectos', async () => {
  expect(await queries.findSoldForTicket(target)).toBeNull();
  await confirm();
  const before = await storedState();
  const result = await queries.findSoldForTicket(target);
  expect(result).toMatchObject({ ...target, soldAt: soldAt.toISOString(), totalPriceCents: 1000 });
  expect(result.passengers.map((p) => p.totalPriceCents)).toEqual([600, 400]);
  expect(result.passengers).toHaveLength(2);
  expect(Object.isFrozen(result.passengers[0])).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(
    /owner-ticket|birthDate|accreditation|privateField|proof-ticket/,
  );
  expect(await queries.findSoldForTicket(target)).toEqual(result);
  expect(await storedState()).toEqual(before);
});
test('identificador opaco se conserva, tenant ajeno y ausencia no filtran venta', async () => {
  await confirm();
  expect(await queries.findSoldForTicket({ ...target, cooperativeId: 'otra' })).toBeNull();
  expect(await queries.findSoldForTicket({ ...target, bookingId: 'ausente' })).toBeNull();
  expect((await queries.findSoldForTicket(target)).bookingId).toBe(target.bookingId);
});
test('rechazo justificado real impide emisión', async () => {
  const confirmer = new PgBookingSaleConfirmer({ pool, clock: () => soldAt });
  await confirmer.rejectSale({
    ...target,
    paymentProofId: 'proof-ticket',
    rejectedBy: 'clerk-ticket',
    justification: 'Importe incorrecto QA',
  });
  expect(await queries.findSoldForTicket(target)).toBeNull();
});
test('reserva expirada no habilita emisión', async () => {
  await clear();
  await pool.query("INSERT INTO booking_trip_locks VALUES('coop-ticket','trip-ticket')");
  await pool.query(
    `INSERT INTO bookings(id,cooperative_id,trip_id,owner_id,from_position,to_position,status,summary,
    base_price_cents,discount_cents,total_price_cents,created_at,expires_at,expired_at,
    proof_window_started_at,proof_window_seconds,proof_reception_state)
    VALUES($1,'coop-ticket','trip-ticket','owner-ticket',0,1,'EXPIRED',$2,
    1000,0,1000,'2026-11-04T14:00:00Z','2026-11-04T14:05:00Z','2026-11-04T14:05:00Z',
    '2026-11-04T14:00:00Z',300,'NOT_RECEIVED')`,
    [target.bookingId, soldRow().summary],
  );
  expect(await queries.findSoldForTicket(target)).toBeNull();
});
test.each(['RESERVED', 'inactive', 'extra', 'range', 'summary'])(
  'incoherencia persistida %s bloquea emisión sin corregir datos',
  async (kind) => {
    await confirm();
    if (kind === 'RESERVED')
      await pool.query(
        "UPDATE booking_seat_allocations SET status='RESERVED' WHERE seat_id='seat-1'",
      );
    if (kind === 'inactive')
      await pool.query("UPDATE booking_seat_allocations SET active=false WHERE seat_id='seat-1'");
    if (kind === 'extra')
      await pool.query(
        "INSERT INTO booking_seat_allocations SELECT booking_id,cooperative_id,trip_id,'seat-extra',from_position,to_position,status,active FROM booking_seat_allocations WHERE seat_id='seat-1'",
      );
    if (kind === 'range')
      await pool.query("UPDATE booking_seat_allocations SET to_position=2 WHERE seat_id='seat-1'");
    if (kind === 'summary')
      await pool.query(
        "UPDATE bookings SET summary=jsonb_set(summary,'{totals,totalPriceCents}','999') WHERE id=$1",
        [target.bookingId],
      );
    const before = await storedState();
    await expect(queries.findSoldForTicket(target)).rejects.toMatchObject({
      code: 'BOOKING_TICKET_DATA_INTEGRITY_ERROR',
    });
    expect(await storedState()).toEqual(before);
  },
);
test('snapshot histórico sin desglose no inventa importes', async () => {
  await confirm();
  await pool.query("UPDATE bookings SET summary=summary-'schemaVersion' WHERE id=$1", [
    target.bookingId,
  ]);
  await expect(queries.findSoldForTicket(target)).rejects.toMatchObject({
    code: 'BOOKING_TICKET_DATA_INTEGRITY_ERROR',
  });
});
test('lectura consistente mientras una transacción actualiza importe y snapshot', async () => {
  await confirm();
  const writer = await pool.connect();
  const next = soldRow().summary;
  next.totals.totalPriceCents = 1100;
  next.passengers[0].quote.totalPriceCents = 700;
  try {
    await writer.query('BEGIN');
    await writer.query(
      'UPDATE bookings SET summary=$2,base_price_cents=1100,total_price_cents=1100 WHERE id=$1',
      [target.bookingId, next],
    );
    expect((await queries.findSoldForTicket(target)).totalPriceCents).toBe(1000);
    await writer.query('COMMIT');
    const after = await queries.findSoldForTicket(target);
    expect(after.totalPriceCents).toBe(1100);
    expect(after.passengers.map((p) => p.totalPriceCents)).toEqual([700, 400]);
  } finally {
    await writer.query('ROLLBACK');
    writer.release();
  }
});
