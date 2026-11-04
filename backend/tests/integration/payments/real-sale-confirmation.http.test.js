// INTEG-01 T4: aprobar o rechazar por HTTP usa el confirmador real de Reservas, no el simulado.
const http = require('node:http');
const { randomBytes, randomUUID } = require('node:crypto');
const createApp = require('../../../src/app');
const { createAuthModule } = require('../../../src/modules/auth');
const { createBookingsModule } = require('../../../src/modules/bookings');
const { createPaymentsModule } = require('../../../src/modules/payments');
const SimulatedBookingSaleConfirmer = require('../../../src/modules/payments/infrastructure/simulated-booking-sale-confirmer');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { runMigration, testPool } = require('../../helpers/database');

const API = '/api/v1/payment-proofs';
const NOW = new Date('2026-11-04T15:00:00.000Z');
let pool;
let server;
let baseUrl;
let payments;
let cooperativeId;

class Browser {
  constructor() {
    this.cookies = new Map();
    this.csrf = '';
  }

  async request(route, method = 'GET', body) {
    const headers = {
      cookie: [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; '),
    };
    if (method !== 'GET') {
      headers['Content-Type'] = 'application/json';
      headers['X-CSRF-Token'] = this.csrf;
    }
    const response = await fetch(baseUrl + route, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0];
      const separator = pair.indexOf('=');
      this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    return response;
  }

  async token() {
    this.csrf = (await (await this.request('/api/v1/auth/csrf')).json()).csrfToken;
  }
}

async function signInClerk() {
  const browser = new Browser();
  const email = `qa-${randomUUID()}@example.ec`;
  const password = randomBytes(24).toString('hex');
  await browser.token();
  await browser.request('/api/v1/auth/register', 'POST', { email, password });
  // Solo fixture en BD de prueba: no presupone un endpoint productivo de alta CLERK.
  const { rows } = await pool.query(
    "UPDATE users SET role = 'CLERK', cooperative_id = $1 WHERE email = $2 RETURNING id",
    [cooperativeId, email],
  );
  await browser.request('/api/v1/auth/login', 'POST', { email, password });
  await browser.token();
  return { browser, userId: rows[0].id };
}

// Reserva pendiente cuyo comprobante ya fue recibido por Reservas, lista para decidir.
async function receivedBookingWithProof({ acceptedOther = false } = {}) {
  const bookingId = randomUUID();
  const tripId = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO payment_proofs(
      booking_id, cooperative_id, status, file_key, original_file_name,
      media_type, file_size_bytes, uploaded_at
    ) VALUES ($1, $2, 'UPLOADED', $3, 'comprobante.png', 'image/png', 10, $4)
    RETURNING *`,
    [bookingId, cooperativeId, randomUUID(), NOW],
  );
  const proof = rows[0];
  await pool.query('INSERT INTO booking_trip_locks VALUES($1, $2)', [cooperativeId, tripId]);
  await pool.query(
    `INSERT INTO bookings(
      id,cooperative_id,trip_id,owner_id,from_position,to_position,status,summary,
      base_price_cents,discount_cents,total_price_cents,created_at,expires_at,
      proof_window_started_at,proof_window_seconds,proof_reception_state,accepted_proof_id,proof_received_at
    ) VALUES($1,$2,$3,'owner-qa',0,1,'PENDING_PAYMENT',$4,1000,0,1000,$5,$6,$5,300,'RECEIVED',$7,$8)`,
    [
      bookingId,
      cooperativeId,
      tripId,
      { passengers: [{ seatId: 'seat-qa' }], totalPriceCents: 1000 },
      NOW,
      new Date(NOW.getTime() + 300000),
      acceptedOther ? randomUUID() : proof.id,
      new Date(NOW.getTime() + 60000),
    ],
  );
  await pool.query(
    `INSERT INTO booking_seat_allocations
      (booking_id,cooperative_id,trip_id,seat_id,from_position,to_position,status,active)
      VALUES($1,$2,$3,'seat-qa',0,1,'RESERVED',true)`,
    [bookingId, cooperativeId, tripId],
  );
  return proof;
}

const bookingState = async (bookingId) =>
  (
    await pool.query(
      `SELECT b.status, b.rejected_by, b.rejection_justification, a.status AS seat, a.active
         FROM bookings b JOIN booking_seat_allocations a ON a.booking_id = b.id
        WHERE b.id = $1`,
      [bookingId],
    )
  ).rows[0];

beforeAll(() => {
  runMigration();
  pool = testPool();
});

beforeEach(async () => {
  assertTestDatabase();
  await pool.query(
    `TRUNCATE booking_guest_access_tokens, booking_proof_receipt_results, booking_seat_allocations,
      bookings, booking_trip_locks, payment_proof_notification_outbox, payment_proofs,
      auth_sessions, users`,
  );
  const ruc = randomUUID().replace(/\D/g, '').slice(0, 13).padStart(13, '7');
  cooperativeId = (
    await pool.query(
      "INSERT INTO cooperatives(name, ruc) VALUES ('Cooperativa venta real', $1) RETURNING id",
      [ruc],
    )
  ).rows[0].id;
  const auth = await createAuthModule({
    pool,
    env: { JWT_SECRET: randomBytes(32).toString('hex') },
  });
  const bookings = createBookingsModule({ pool, auth, clock: () => NOW });
  payments = createPaymentsModule({ pool, auth, bookingSaleConfirmer: bookings.saleConfirmer });
  server = http.createServer(createApp({ auth, payments, pool }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
});

afterAll(async () => {
  if (pool) await pool.end();
});

test('Pagos usa el confirmador real que expone Reservas', () => {
  expect(payments.bookingSaleConfirmer).not.toBeInstanceOf(SimulatedBookingSaleConfirmer);
  expect(typeof payments.bookingSaleConfirmer.confirmSale).toBe('function');
  expect(typeof payments.bookingSaleConfirmer.rejectSale).toBe('function');
});

test('aprobar por HTTP vende la reserva y su asiento en PostgreSQL; repetir no duplica', async () => {
  const { browser, userId } = await signInClerk();
  const proof = await receivedBookingWithProof();
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await browser.request(`${API}/${proof.id}/approve`, 'POST', {});
    expect(response.status).toBe(200);
    expect((await response.json()).paymentProof).toMatchObject({ decision: 'APPROVED' });
  }
  expect(await bookingState(proof.booking_id)).toMatchObject({
    status: 'SOLD',
    seat: 'SOLD',
    active: true,
  });
  const saved = (await pool.query('SELECT * FROM payment_proofs WHERE id = $1', [proof.id]))
    .rows[0];
  expect(saved.approved_by).toBe(userId);
});

test('rechazar por HTTP libera el asiento y guarda actor y motivo en Reservas y Pagos', async () => {
  const { browser, userId } = await signInClerk();
  const proof = await receivedBookingWithProof();
  const response = await browser.request(`${API}/${proof.id}/reject`, 'POST', {
    justification: 'El comprobante no corresponde al titular.',
  });
  expect(response.status).toBe(200);
  expect(await bookingState(proof.booking_id)).toMatchObject({
    status: 'REJECTED',
    rejected_by: userId,
    rejection_justification: 'El comprobante no corresponde al titular.',
    active: false,
  });
  const saved = (await pool.query('SELECT * FROM payment_proofs WHERE id = $1', [proof.id]))
    .rows[0];
  expect(saved).toMatchObject({
    rejected_by: userId,
    rejection_justification: 'El comprobante no corresponde al titular.',
  });
});

test('Reservas rechaza aprobar si el comprobante no es el recibido y Pagos no aprueba', async () => {
  const { browser } = await signInClerk();
  // Reservas ya aceptó otro comprobante para esta reserva; la base impide cambiarlo después.
  const proof = await receivedBookingWithProof({ acceptedOther: true });
  const response = await browser.request(`${API}/${proof.id}/approve`, 'POST', {});
  expect(response.status).toBe(409);
  expect((await response.json()).error.code).toBe('BOOKING_SALE_REJECTED');
  expect(await bookingState(proof.booking_id)).toMatchObject({
    status: 'PENDING_PAYMENT',
    seat: 'RESERVED',
  });
  const saved = (await pool.query('SELECT * FROM payment_proofs WHERE id = $1', [proof.id]))
    .rows[0];
  expect(saved.approved_at).toBeNull();
});
