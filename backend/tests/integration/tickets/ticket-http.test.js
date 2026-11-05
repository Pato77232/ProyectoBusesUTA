const http = require('node:http');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const createApp = require('../../../src/app');
const { createAuthModule } = require('../../../src/modules/auth');
const { createBookingTicketQueries } = require('../../../src/modules/bookings');
const PgBookingSaleConfirmer = require('../../../src/modules/bookings/infrastructure/pg-booking-sale-confirmer');
const { createTicketsModule } = require('../../../src/modules/tickets');
const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { soldRowWithTrip } = require('../../helpers/sold-booking-ticket-trip');

const env = {
  JWT_SECRET: 'secreto-ficticio-solo-para-pruebas-http-123456',
  JWT_EXPIRES_IN: '30m',
};
const bookingId = 'venta-opaca/qa';
const path = `/api/v1/tickets/bookings/${encodeURIComponent(bookingId)}`;
let pool, server, url;
let owner, stranger;

async function customer() {
  const id = randomUUID();
  const sid = randomUUID();
  await pool.query(
    `INSERT INTO users (id,email,password_hash,role)
     VALUES ($1,$2,'hash-no-utilizado-en-autenticacion-de-sesion','CUSTOMER')`,
    [id, `cliente-${id}@example.ec`],
  );
  await pool.query(
    `INSERT INTO auth_sessions (id,user_id,expires_at) VALUES ($1,$2,CURRENT_TIMESTAMP + interval '1 hour')`,
    [sid, id],
  );
  const token = jwt.sign({ sub: id, sid, role: 'CUSTOMER', cooperative_id: null }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '30m',
  });
  return { id, cookie: `access_token=${token}` };
}

function get(target, who) {
  return fetch(url + target, { headers: who ? { cookie: who.cookie } : {} });
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

beforeAll(async () => {
  assertTestDatabase();
  runMigration();
  pool = testPool();
  const auth = await createAuthModule({ pool, env });
  const tickets = createTicketsModule({
    pool,
    auth,
    soldBookings: createBookingTicketQueries({ pool }),
  });
  server = http.createServer(createApp({ auth, tickets, pool }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE tickets, auth_sessions, users, booking_guest_access_tokens, booking_benefit_reviews, booking_proof_receipt_results, booking_seat_allocations, bookings, booking_trip_locks CASCADE',
  );
  owner = await customer();
  stranger = await customer();
  const row = soldRowWithTrip();
  await pool.query("INSERT INTO booking_trip_locks VALUES('coop-ticket','trip-ticket')");
  await pool.query(
    `INSERT INTO bookings(id,cooperative_id,trip_id,owner_id,from_position,to_position,status,summary,
    base_price_cents,discount_cents,total_price_cents,created_at,expires_at,
    proof_window_started_at,proof_window_seconds,proof_reception_state,accepted_proof_id,proof_received_at)
    VALUES($1,'coop-ticket','trip-ticket',$2,0,1,'PENDING_PAYMENT',$3,
    1000,0,1000,'2026-11-04T14:00:00Z','2026-11-04T14:05:00Z',
    '2026-11-04T14:00:00Z',300,'RECEIVED','proof-ticket','2026-11-04T14:01:00Z')`,
    [bookingId, owner.id, row.summary],
  );
  for (const p of row.summary.passengers)
    await pool.query(
      `INSERT INTO booking_seat_allocations VALUES($1,'coop-ticket','trip-ticket',$2,0,1,'RESERVED',true)`,
      [bookingId, p.seatId],
    );
});

afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) {
    await pool.query(
      'TRUNCATE tickets, auth_sessions, users, booking_seat_allocations, bookings, booking_trip_locks CASCADE',
    );
    await pool.end();
  }
});

test('sin sesión responde 401 sin guardar la respuesta en caché', async () => {
  const response = await get(path);
  expect(response.status).toBe(401);
  expect(response.headers.get('cache-control')).toBe('no-store');
});

test('el propietario de una venta recibe sus boletos con un QR real y sin datos internos', async () => {
  await confirm();
  const response = await get(path, owner);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const body = await response.json();
  expect(body).toMatchObject({
    bookingId,
    currency: 'USD',
    totalPriceCents: 1000,
    trip: {
      departureDate: '2026-11-10',
      origin: { locationKey: 'Ambato' },
      destination: { locationKey: 'Latacunga' },
    },
  });
  expect(body.tickets).toHaveLength(2);
  for (const ticket of body.tickets) {
    expect(ticket.qrSvg).toMatch(/^<svg[\s>]/);
    expect(ticket.qrPayload).toBe(`TRANSVIAJE:TICKET:${ticket.code}`);
    const expected = await QRCode.toString(ticket.qrPayload, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
    });
    expect(ticket.qrSvg).toBe(expected);
    const [segment] = QRCode.create(ticket.qrPayload, { errorCorrectionLevel: 'M' }).segments;
    expect(String(segment.data)).toBe(ticket.qrPayload);
  }
  expect(JSON.stringify(body)).not.toContain(owner.id);
  expect(body).not.toHaveProperty('cooperativeId');
  const again = await (await get(path, owner)).json();
  expect(again.tickets.map((t) => t.code)).toEqual(body.tickets.map((t) => t.code));
});

test('otro cliente, una reserva inexistente y una no vendida reciben el mismo 404', async () => {
  const pending = await get(path, owner);
  await confirm();
  const foreign = await get(path, stranger);
  const missing = await get('/api/v1/tickets/bookings/ausente', owner);
  const bodies = await Promise.all([pending, foreign, missing].map((r) => r.json()));
  expect([pending.status, foreign.status, missing.status]).toEqual([404, 404, 404]);
  expect(new Set(bodies.map((b) => JSON.stringify(b))).size).toBe(1);
  expect(bodies[0].error.code).toBe('TICKET_NOT_FOUND');
  expect((await pool.query('SELECT count(*)::int AS n FROM tickets')).rows[0].n).toBe(0);
});

test('un identificador demasiado largo responde 400 sin emitir', async () => {
  await confirm();
  const response = await get(`/api/v1/tickets/bookings/${'x'.repeat(201)}`, owner);
  expect(response.status).toBe(400);
  expect((await response.json()).error.code).toBe('TICKET_QUERY_INVALID');
});
