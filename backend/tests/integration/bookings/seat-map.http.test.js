// FRONT-02 T3: distribución visible del viaje publicado, sin cambiar la disponibilidad.
const http = require('node:http');
const { start } = require('../../../src/server');
const { createHasher } = require('../../../src/modules/auth/infrastructure/password-hasher');
const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { fleetFixtures, busRequest } = require('../../helpers/fleet-bus');
const makeFixture = require('../../helpers/route-programming');
const Browser = require('../../helpers/session-browser');
const { randomUUID } = require('node:crypto');
const PgBusRepository = require('../../../src/modules/fleet/infrastructure/pg-bus.repository');
const PASSWORD = 'clave-mapa-asientos-ficticia-2030';
let pool, running, hash, admin, customer, owner, fixture, tripId, baseUrl;
async function clear() {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE booking_guest_access_tokens,booking_proof_receipt_results,booking_seat_allocations,bookings,booking_trip_locks',
  );
  await pool.query('TRUNCATE cooperatives,users,auth_sessions CASCADE');
}
beforeAll(async () => {
  assertTestDatabase();
  runMigration();
  pool = testPool();
  hash = await (await createHasher()).hash(PASSWORD);
  const probe = http.createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  running = await start({
    PORT: String(port),
    DATABASE_URL: assertTestDatabase(),
    JWT_SECRET: 'mapa-asientos-qa-secret-abc-1234567890',
    NODE_ENV: 'test',
    BOOKING_EXPIRATION_ENABLED: 'false',
  });
  baseUrl = `http://127.0.0.1:${port}`;
});
afterAll(async () => {
  if (running) await running.stop();
  if (pool) {
    await clear();
    await pool.end();
  }
});
beforeEach(async () => {
  await clear();
  owner = (await fleetFixtures(pool)).first;
  const bus = await new PgBusRepository(pool).create(busRequest(owner));
  fixture = makeFixture({ ...owner, busId: bus.id, date: '2030-01-01' });
  for (const frequency of fixture.frequencies)
    await pool.query(
      'INSERT INTO frequencies(id,cooperative_id,origin,destination,departure_time,ant_resolution_number) VALUES($1,$2,$3,$4,$5,$6)',
      [
        frequency.id,
        owner.cooperativeId,
        frequency.origin,
        frequency.destination,
        frequency.departureTime,
        frequency.antResolutionNumber,
      ],
    );
  await pool.query(
    "INSERT INTO frequency_stops(frequency_id,position,place) VALUES($1,0,'Salcedo')",
    [fixture.frequencies[0].id],
  );
  fixture.body.programming.agendas[0].activities[0].points = [
    { position: 0, departureAt: '2030-01-01T07:00:00-05:00' },
    {
      position: 1,
      arrivalAt: '2030-01-01T07:25:00-05:00',
      departureAt: '2030-01-01T07:30:00-05:00',
    },
    { position: 2, arrivalAt: '2030-01-01T08:00:00-05:00' },
  ];
  await pool.query(
    "INSERT INTO users(email,password_hash,role,cooperative_id) VALUES('seatmap-admin@example.ec',$1,'COOPERATIVE_ADMIN',$2),('seatmap-customer@example.ec',$1,'CUSTOMER',NULL)",
    [hash, owner.cooperativeId],
  );
  admin = new Browser(baseUrl);
  customer = new Browser(baseUrl);
  await admin.login('seatmap-admin@example.ec', PASSWORD);
  await customer.login('seatmap-customer@example.ec', PASSWORD);
  const created = await admin.request('/api/v1/route-sheets', 'POST', {
    busGroupId: owner.busGroupId,
    routeDate: '2030-01-01',
  });
  expect(created.status).toBe(201);
  const sheetId = (await created.json()).routeSheet.id;
  const endpoint = `/api/v1/route-sheets/${sheetId}`;
  expect((await admin.request(endpoint + '/programming', 'PUT', fixture.body)).status).toBe(200);
  expect(
    (
      await admin.request(endpoint + '/tariff', 'PUT', {
        expectedRevision: 0,
        policy: {
          vipSurchargeBps: 2500,
          minorDiscountBps: 5000,
          seniorDiscountBps: 5000,
          disabilityDiscountBps: 5000,
        },
        frequencies: fixture.frequencies.map((f, index) => ({
          frequencyId: f.id,
          prices:
            index === 0
              ? [
                  { fromPosition: 0, toPosition: 1, amountCents: 200 },
                  { fromPosition: 0, toPosition: 2, amountCents: 450 },
                  { fromPosition: 1, toPosition: 2, amountCents: 250 },
                ]
              : [{ fromPosition: 0, toPosition: 1, amountCents: 450 }],
        })),
      })
    ).status,
  ).toBe(200);
  const published = await admin.request(endpoint + '/publish', 'POST', {});
  expect(published.status).toBe(200);
  tripId = (await published.json()).routeSheet.commercial.tripIds[0];
});
const query = (from = 0, to = 1, id = tripId) =>
  `tripId=${id}&fromPosition=${from}&toPosition=${to}`;
const seatMap = (browser = customer, suffix = query()) =>
  browser.request(`/api/v1/bookings/seat-map?${suffix}`);

test('entrega número y posición de los mismos asientos que la disponibilidad', async () => {
  const response = await seatMap();
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const { seats } = await response.json();
  const availability = (
    await (await customer.request(`/api/v1/bookings/availability?${query()}`)).json()
  ).seats;
  expect(new Set(seats.map((seat) => seat.seatId))).toEqual(
    new Set(availability.map((seat) => seat.seatId)),
  );
  expect(
    seats.every(
      (seat) =>
        Object.keys(seat).sort().join(',') === 'category,column,deck,label,row,seatId' &&
        Number.isSafeInteger(seat.label) &&
        seat.label >= 1,
    ),
  ).toBe(true);
  expect(new Set(seats.map((seat) => seat.label)).size).toBe(seats.length);
  expect((await pool.query('SELECT count(*)::int n FROM bookings')).rows[0].n).toBe(0);
});

test('aplica rol de cliente y rechaza parámetros falsificados o viajes ausentes', async () => {
  expect((await seatMap(customer, query(0, 1, randomUUID()))).status).toBe(404);
  expect((await seatMap(customer, query(0, 9))).status).toBe(400);
  expect((await seatMap(customer, `${query()}&cooperativeId=${randomUUID()}`)).status).toBe(400);
  expect((await seatMap(new Browser(baseUrl))).status).toBe(401);
  expect((await seatMap(admin)).status).toBe(403);
});
