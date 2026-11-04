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
    'TRUNCATE booking_proof_receipt_results,booking_seat_allocations,bookings,booking_trip_locks',
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
async function occupy(
  seatId,
  from,
  to,
  status = 'RESERVED',
  received = false,
  targetTrip = tripId,
  active = true,
) {
  // Ocupaciones sintéticas: no certifican creación, venta ni aceptación Auth de un comprobante.
  const id = randomUUID();
  await pool.query(
    'INSERT INTO booking_trip_locks(cooperative_id,trip_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
    [owner.cooperativeId, targetTrip],
  );
  await pool.query(
    `INSERT INTO bookings(id,cooperative_id,trip_id,owner_id,from_position,to_position,status,summary,base_price_cents,discount_cents,total_price_cents,created_at,expires_at,proof_window_started_at,proof_window_seconds,proof_reception_state,accepted_proof_id,proof_received_at)
    VALUES($1,$2,$3,'propietario-privado',$4,$5,'PENDING_PAYMENT',$6,100,0,100,'2026-11-03T14:00:00Z','2026-11-03T14:05:00Z',$7,$8,$9,$10,$11)`,
    [
      id,
      owner.cooperativeId,
      targetTrip,
      from,
      to,
      { passengers: [{ seatId }], totals: { totalPriceCents: 100 } },
      received ? '2026-11-03T14:00:00Z' : null,
      received ? 300 : null,
      received ? 'RECEIVED' : 'UNKNOWN',
      received ? randomUUID() : null,
      received ? '2026-11-03T14:01:00Z' : null,
    ],
  );
  await pool.query('INSERT INTO booking_seat_allocations VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [
    id,
    owner.cooperativeId,
    targetTrip,
    seatId,
    from,
    to,
    status,
    active,
  ]);
}
test('servidor real consulta copia publicada y solo entrega seatId/status con no-store', async () => {
  expect(seats.length).toBeGreaterThan(3);
  expect(
    seats.every(
      (seat) =>
        Object.keys(seat).sort().join(',') === 'seatId,status' && seat.status === 'AVAILABLE',
    ),
  ).toBe(true);
  const response = await request();
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect((await pool.query('SELECT count(*)::int n FROM bookings')).rows[0].n).toBe(0);
});
test('RESERVED/SOLD/revisión bloquean superposición parcial y permiten adyacencia', async () => {
  await occupy(seats[0].seatId, 0, 2);
  await occupy(seats[1].seatId, 1, 2, 'SOLD');
  await occupy(seats[2].seatId, 0, 1, 'RESERVED', true);
  await occupy(seats[3].seatId, 0, 2, 'RESERVED', false, tripId, false);
  const before = (await pool.query('SELECT row_to_json(b) AS value FROM bookings b ORDER BY id'))
    .rows;
  const first = (await (await request(0, 1)).json()).seats;
  const second = (await (await request(1, 2)).json()).seats;
  expect(first.slice(0, 4).map((s) => s.status)).toEqual([
    'RESERVED',
    'AVAILABLE',
    'RESERVED',
    'AVAILABLE',
  ]);
  expect(second.slice(0, 4).map((s) => s.status)).toEqual([
    'RESERVED',
    'SOLD',
    'AVAILABLE',
    'AVAILABLE',
  ]);
  expect(
    (await pool.query('SELECT row_to_json(b) AS value FROM bookings b ORDER BY id')).rows,
  ).toEqual(before);
  expect(JSON.stringify(first)).not.toContain('propietario-privado');
});
test('no mezcla ocupaciones de otro viaje aunque compartan identificador de asiento en la fixture', async () => {
  await occupy(seats[0].seatId, 0, 2, 'SOLD', false, randomUUID());
  expect((await (await request()).json()).seats[0].status).toBe('AVAILABLE');
});
test('ausente, fuera de recorrido y parámetros falsificados se distinguen sin devolver libres', async () => {
  expect((await customer.request(endpoint(0, 1, randomUUID()))).status).toBe(404);
  expect((await request(0, 9)).status).toBe(400);
  expect((await customer.request(endpoint() + '&cooperativeId=' + randomUUID())).status).toBe(400);
  expect((await new Browser(baseUrl).request(endpoint())).status).toBe(401);
  expect((await admin.request(endpoint())).status).toBe(403);
});
