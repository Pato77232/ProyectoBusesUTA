// INTEG-01 T5: el enlace de invitado se canjea por HTTP una sola vez, sin sesión ni caché.
const http = require('node:http');
const { randomBytes } = require('node:crypto');
const createApp = require('../../../src/app');
const { createAuthModule } = require('../../../src/modules/auth');
const { createBookingsModule } = require('../../../src/modules/bookings');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { runMigration, testPool } = require('../../helpers/database');

const API = '/api/v1/guest/bookings/';
const NOW = new Date('2026-11-04T15:00:00.000Z');
let pool;
let server;
let baseUrl;
let bookings;
let now;

async function seedBooking(id = 'booking-guest', ownerId = 'owner-guest') {
  await pool
    .query("INSERT INTO booking_trip_locks VALUES('coop-guest','trip-guest')")
    .catch(() => {});
  await pool.query(
    `INSERT INTO bookings(
      id,cooperative_id,trip_id,owner_id,from_position,to_position,status,summary,
      base_price_cents,discount_cents,total_price_cents,created_at,expires_at,
      proof_window_started_at,proof_window_seconds,proof_reception_state
    ) VALUES($1,'coop-guest','trip-guest',$2,0,1,'PENDING_PAYMENT',$3,1000,0,1000,$4,$5,$4,300,'NOT_RECEIVED')`,
    [
      id,
      ownerId,
      { passengers: [{ seatId: 'seat-guest' }], totalPriceCents: 1000, currency: 'USD' },
      NOW,
      new Date(NOW.getTime() + 300000),
    ],
  );
}

const consume = (token) => fetch(baseUrl + API + encodeURIComponent(token));

beforeAll(() => {
  runMigration();
  pool = testPool();
});

beforeEach(async () => {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE booking_guest_access_tokens, booking_proof_receipt_results, booking_seat_allocations, bookings, booking_trip_locks',
  );
  now = NOW;
  const auth = await createAuthModule({
    pool,
    env: { JWT_SECRET: randomBytes(32).toString('hex') },
  });
  bookings = createBookingsModule({ pool, auth, clock: () => now });
  server = http.createServer(createApp({ auth, bookings, pool }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
});

afterAll(async () => {
  if (pool) await pool.end();
});

test('el enlace entrega solo datos mínimos de su reserva una vez y sin caché', async () => {
  await seedBooking();
  const { token } = await bookings.guestAccess.issue({
    bookingId: 'booking-guest',
    ownerId: 'owner-guest',
  });
  const first = await consume(token);
  expect(first.status).toBe(200);
  expect(first.headers.get('cache-control')).toBe('no-store');
  const { booking } = await first.json();
  expect(booking).toMatchObject({
    bookingId: 'booking-guest',
    status: 'PENDING_PAYMENT',
    tripId: 'trip-guest',
    totalPriceCents: 1000,
    currency: 'USD',
  });
  expect(JSON.stringify(booking)).not.toContain('owner-guest');
  expect(JSON.stringify(booking)).not.toContain('coop-guest');
  const stored = (await pool.query('SELECT token_hash, used_at FROM booking_guest_access_tokens'))
    .rows[0];
  expect(stored.token_hash).not.toBe(token);
  expect(stored.used_at).not.toBeNull();
  const second = await consume(token);
  expect(second.status).toBe(404);
  expect(second.headers.get('cache-control')).toBe('no-store');
});

test('enlace inexistente, vencido o reutilizado responden igual, sin revelar cuál falló', async () => {
  await seedBooking();
  const { token: expired } = await bookings.guestAccess.issue({
    bookingId: 'booking-guest',
    ownerId: 'owner-guest',
  });
  const { token: used } = await bookings.guestAccess.issue({
    bookingId: 'booking-guest',
    ownerId: 'owner-guest',
  });
  expect((await consume(used)).status).toBe(200);
  now = new Date(NOW.getTime() + 16 * 60 * 1000);
  const responses = await Promise.all(
    [randomBytes(32).toString('base64url'), 'corto', expired, used].map(consume),
  );
  const bodies = await Promise.all(responses.map((response) => response.json()));
  expect(responses.map((response) => response.status)).toEqual([404, 404, 404, 404]);
  expect(new Set(bodies.map((body) => JSON.stringify(body))).size).toBe(1);
  expect(bodies[0].error.code).toBe('GUEST_ACCESS_INVALID');
});

test('no emite enlaces para una reserva de otro propietario', async () => {
  await seedBooking();
  await expect(
    bookings.guestAccess.issue({ bookingId: 'booking-guest', ownerId: 'otro-propietario' }),
  ).rejects.toMatchObject({ code: 'GUEST_ACCESS_INVALID' });
  expect(
    (await pool.query('SELECT count(*)::int AS n FROM booking_guest_access_tokens')).rows[0].n,
  ).toBe(0);
});
