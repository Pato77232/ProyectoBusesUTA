const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { start } = require('../../../src/server');
const { createHasher } = require('../../../src/modules/auth/infrastructure/password-hasher');
const PgBusRepository = require('../../../src/modules/fleet/infrastructure/pg-bus.repository');
const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { fleetFixtures, busRequest } = require('../../helpers/fleet-bus');
const makeFixture = require('../../helpers/route-programming');
const Browser = require('../../helpers/session-browser');
const PASSWORD = 'clave-disponibilidad-ficticia-2030';
let pool, running, hash, admin, customer, owner, fixture, tripId, seats, baseUrl;
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
    JWT_SECRET: 'disponibilidad-real-qa-secret-1234567890',
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
    "INSERT INTO users(email,password_hash,role,cooperative_id) VALUES('availability-admin@example.ec',$1,'COOPERATIVE_ADMIN',$2),('availability-customer@example.ec',$1,'CUSTOMER',NULL)",
    [hash, owner.cooperativeId],
  );
  admin = new Browser(baseUrl);
  customer = new Browser(baseUrl);
  await admin.login('availability-admin@example.ec', PASSWORD);
  await customer.login('availability-customer@example.ec', PASSWORD);
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
  const initial = await request();
  expect(initial.status).toBe(200);
  seats = (await initial.json()).seats;
});
const endpoint = (fromPosition = 0, toPosition = 1, id = tripId) =>
  `/api/v1/bookings/availability?tripId=${id}&fromPosition=${fromPosition}&toPosition=${toPosition}`;
const request = (fromPosition, toPosition) => customer.request(endpoint(fromPosition, toPosition));

let sheetId;
const editorPath = () => `/api/v1/route-sheets/${sheetId}/editor`;
beforeEach(async () => {
  sheetId = (await pool.query('SELECT route_sheet_id FROM route_sheet_trips WHERE id=$1', [tripId]))
    .rows[0].route_sheet_id;
});
test('servidor real entrega publicación propia, tarifa congelada y catálogos sin datos privados del bus', async () => {
  const response = await admin.request(editorPath());
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const context = await response.json();
  expect(context.sheet).toMatchObject({
    id: sheetId,
    cooperativeId: owner.cooperativeId,
    busGroupId: owner.busGroupId,
    status: 'PUBLISHED',
  });
  expect(context.programming.revision).toBe(1);
  expect(context.tariff.revision).toBe(1);
  expect(context.tariff.tariff.frequencies).toHaveLength(3);
  expect(context.buses).toHaveLength(1);
  expect(context.buses[0].vin).toBeUndefined();
  expect(context.buses[0].photos).toBeUndefined();
  expect(context.frequencies.every((f) => f.cooperativeId === owner.cooperativeId)).toBe(true);
});
test('borrador sin programación ni tarifa devuelve ausencia explícita y catálogos utilizables', async () => {
  const created = await admin.request('/api/v1/route-sheets', 'POST', {
    busGroupId: owner.busGroupId,
    routeDate: '2030-01-02',
  });
  expect(created.status).toBe(201);
  const id = (await created.json()).routeSheet.id;
  const response = await admin.request(`/api/v1/route-sheets/${id}/editor`);
  expect(response.status).toBe(200);
  const context = await response.json();
  expect(context.sheet.status).toBe('DRAFT');
  expect(context.programming).toMatchObject({ revision: 0, programming: null });
  expect(context.tariff).toMatchObject({ revision: 0, tariff: null });
});
test('sesión, rol, UUID y tenant se verifican sin revelar hojas ajenas', async () => {
  expect((await new Browser(baseUrl).request(editorPath())).status).toBe(401);
  expect((await customer.request(editorPath())).status).toBe(403);
  expect((await admin.request('/api/v1/route-sheets/invalido/editor')).status).toBe(400);
  expect((await admin.request(`/api/v1/route-sheets/${randomUUID()}/editor`)).status).toBe(404);
  const second = (
    await pool.query('SELECT id FROM cooperatives WHERE id<>$1 LIMIT 1', [owner.cooperativeId])
  ).rows[0].id;
  await pool.query(
    "INSERT INTO users(email,password_hash,role,cooperative_id) VALUES('editor-other@example.ec',$1,'COOPERATIVE_ADMIN',$2)",
    [hash, second],
  );
  const outsider = new Browser(baseUrl);
  await outsider.login('editor-other@example.ec', PASSWORD);
  expect((await outsider.request(editorPath())).status).toBe(404);
});
test('solo lectura publicada se conserva también ante PUT directo y el contexto queda idéntico', async () => {
  const before = await (await admin.request(editorPath())).json();
  expect(
    (
      await admin.request(`/api/v1/route-sheets/${sheetId}/programming`, 'PUT', {
        ...fixture.body,
        expectedRevision: 1,
      })
    ).status,
  ).toBe(409);
  expect(await (await admin.request(editorPath())).json()).toEqual(before);
});
