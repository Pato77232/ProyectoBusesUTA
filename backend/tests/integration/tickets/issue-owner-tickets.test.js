const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { createBookingTicketQueries } = require('../../../src/modules/bookings');
const PgBookingSaleConfirmer = require('../../../src/modules/bookings/infrastructure/pg-booking-sale-confirmer');
const { createTicketsModule } = require('../../../src/modules/tickets');
const { OWNER_ID, soldRowWithTrip } = require('../../helpers/sold-booking-ticket-trip');

const bookingId = 'venta-opaca/qa';
const target = { bookingId, ownerId: OWNER_ID };
const issuedAt = new Date('2026-11-04T15:00:00.000Z');
let pool, tickets;

async function clear() {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE tickets,booking_guest_access_tokens,booking_benefit_reviews,booking_proof_receipt_results,booking_seat_allocations,bookings,booking_trip_locks CASCADE',
  );
}

async function confirm() {
  const confirmer = new PgBookingSaleConfirmer({
    pool,
    clock: () => new Date('2026-11-04T14:02:00Z'),
  });
  await expect(
    confirmer.confirmSale({
      bookingId,
      cooperativeId: 'coop-ticket',
      paymentProofId: 'proof-ticket',
    }),
  ).resolves.toBe(true);
}

async function storedTickets() {
  return (await pool.query('SELECT * FROM tickets ORDER BY seat_id')).rows;
}

beforeAll(() => {
  assertTestDatabase();
  runMigration();
  pool = testPool();
  tickets = createTicketsModule({
    pool,
    soldBookings: createBookingTicketQueries({ pool }),
    clock: () => issuedAt,
  });
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

test('una reserva pendiente no emite boletos; al venderse se emite uno por asiento', async () => {
  await expect(tickets.issueOwnerTickets(target)).rejects.toMatchObject({
    code: 'TICKET_NOT_FOUND',
  });
  expect(await storedTickets()).toHaveLength(0);
  await confirm();
  const sheet = await tickets.issueOwnerTickets(target);
  expect(sheet.tickets.map((t) => t.seatId)).toEqual(['seat-1', 'seat-2']);
  expect(sheet.tickets.every((t) => t.issuedAt === issuedAt.toISOString())).toBe(true);
  const rows = await storedTickets();
  expect(rows.map((r) => [r.cooperative_id, r.booking_id, r.seat_id])).toEqual([
    ['coop-ticket', bookingId, 'seat-1'],
    ['coop-ticket', bookingId, 'seat-2'],
  ]);
  expect(rows.map((r) => r.code)).toEqual(sheet.tickets.map((t) => t.code));
});

test('consultas repetidas y simultáneas conservan un único boleto por asiento', async () => {
  await confirm();
  const results = await Promise.all(
    Array.from({ length: 8 }, () => tickets.issueOwnerTickets(target)),
  );
  const codes = results.map((sheet) => sheet.tickets.map((t) => t.code).join());
  expect(new Set(codes).size).toBe(1);
  expect(await storedTickets()).toHaveLength(2);
  const again = await tickets.issueOwnerTickets(target);
  expect(again.tickets.map((t) => t.code).join()).toBe(codes[0]);
});

test('otro propietario recibe 404 y no se emite nada', async () => {
  await confirm();
  await expect(
    tickets.issueOwnerTickets({ ...target, ownerId: 'otro-cliente' }),
  ).rejects.toMatchObject({ code: 'TICKET_NOT_FOUND', httpStatus: 404 });
  expect(await storedTickets()).toHaveLength(0);
});

test('la emisión no modifica la venta ni los asientos', async () => {
  await confirm();
  const state = async () => ({
    bookings: (await pool.query('SELECT * FROM bookings')).rows,
    seats: (await pool.query('SELECT * FROM booking_seat_allocations ORDER BY seat_id')).rows,
  });
  const before = await state();
  await tickets.issueOwnerTickets(target);
  expect(await state()).toEqual(before);
});

test('la base rechaza códigos inválidos y la reversión se bloquea con boletos emitidos', async () => {
  await expect(
    pool.query(
      `INSERT INTO tickets VALUES (gen_random_uuid(),'coop-ticket','otra','seat-1','corto',now())`,
    ),
  ).rejects.toMatchObject({ code: '23514' });
  await confirm();
  await tickets.issueOwnerTickets(target);
  expect(() => runMigration('down')).toThrow();
  expect(await storedTickets()).toHaveLength(2);
  await pool.query('TRUNCATE tickets');
  runMigration('down');
  expect((await pool.query("SELECT to_regclass('public.tickets') AS t")).rows[0].t).toBeNull();
  runMigration();
});
