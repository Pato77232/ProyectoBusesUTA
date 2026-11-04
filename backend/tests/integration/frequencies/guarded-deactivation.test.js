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

const { createFrequencyCommitmentQueries } = require('../../../src/modules/route-sheets');
const { createBookingOccupancyQueries } = require('../../../src/modules/bookings');
const PgFrequencyRepository = require('../../../src/modules/frequencies/infrastructure/pg-frequency.repository');
const changeStatus = require('../../../src/modules/frequencies/application/change-frequency-status.use-case');
const { setTimeout: delay } = require('node:timers/promises');
const frequencyPath = () => `/api/v1/frequencies/${fixture.frequencies[0].id}/status`;
const deactivate = () => admin.request(frequencyPath(), 'PATCH', { status: 'INACTIVE' });
const policy = () =>
  createFrequencyCommitmentQueries({ occupancyQueries: createBookingOccupancyQueries({ pool }) });
const actor = () => ({ role: 'COOPERATIVE_ADMIN', cooperative_id: owner.cooperativeId });

test('el servidor real rechaza baja con ciclo y servicios futuros y conserva frecuencia', async () => {
  const before = (
    await pool.query('SELECT * FROM frequencies WHERE id=$1', [fixture.frequencies[0].id])
  ).rows;
  const response = await deactivate();
  expect(response.status).toBe(409);
  expect((await response.json()).error.code).toBe('FREQUENCY_HAS_COMMITMENTS');
  expect(
    (await pool.query('SELECT * FROM frequencies WHERE id=$1', [fixture.frequencies[0].id])).rows,
  ).toEqual(before);
});
test('la consulta pública cuenta pasajeros activos y aísla otra cooperativa', async () => {
  await occupy(seats[0].seatId, 0, 1, 'RESERVED', true);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const session = policy().forTransaction(client);
    await session.lock();
    expect(
      await session.find({
        frequencyId: fixture.frequencies[0].id,
        cooperativeId: owner.cooperativeId,
      }),
    ).toMatchObject({
      verifiable: true,
      hasPassengers: true,
      hasUnfinishedCycles: true,
      hasFutureServices: true,
    });
    expect(
      await session.find({ frequencyId: fixture.frequencies[0].id, cooperativeId: randomUUID() }),
    ).toEqual({
      verifiable: true,
      hasPassengers: false,
      hasUnfinishedCycles: false,
      hasFutureServices: false,
    });
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});
test('fin exclusivo exacto permite baja sin alterar las ventas históricas', async () => {
  await occupy(seats[0].seatId, 0, 1, 'SOLD');
  const before = (await pool.query('SELECT * FROM booking_seat_allocations')).rows;
  const real = policy();
  // Solo el reloj se fija en pruebas; SQL y contratos de ambos módulos son reales.
  const commitmentQueries = {
    forTransaction(executor) {
      return real.forTransaction({
        query(sql, ...args) {
          if (sql === 'SELECT clock_timestamp() AS checked_at')
            return Promise.resolve({ rows: [{ checked_at: new Date('2030-01-02T05:00:00Z') }] });
          return executor.query(sql, ...args);
        },
      });
    },
  };
  const useCase = changeStatus({
    repository: new PgFrequencyRepository(pool, { commitmentQueries }),
  });
  expect((await useCase(fixture.frequencies[0].id, 'INACTIVE', actor())).status).toBe('INACTIVE');
  expect((await pool.query('SELECT * FROM booking_seat_allocations')).rows).toEqual(before);
});
test('proveedor ausente hace rollback sin cambiar el estado', async () => {
  const useCase = changeStatus({ repository: new PgFrequencyRepository(pool) });
  await expect(useCase(fixture.frequencies[0].id, 'INACTIVE', actor())).rejects.toMatchObject({
    code: 'FREQUENCY_COMMITMENTS_UNAVAILABLE',
  });
  expect(
    (await pool.query('SELECT status FROM frequencies WHERE id=$1', [fixture.frequencies[0].id]))
      .rows[0].status,
  ).toBe('ACTIVE');
});
test('una frecuencia sin compromisos admite baja, reintento y reactivación', async () => {
  const { rows } = await pool.query(
    "INSERT INTO frequencies(cooperative_id,origin,destination,departure_time,ant_resolution_number) VALUES($1,'Libre','Destino','19:00','ANT-QA') RETURNING id",
    [owner.cooperativeId],
  );
  const path = `/api/v1/frequencies/${rows[0].id}/status`;
  for (const status of ['INACTIVE', 'INACTIVE', 'ACTIVE']) {
    const response = await admin.request(path, 'PATCH', { status });
    expect(response.status).toBe(200);
    expect((await response.json()).frequency.status).toBe(status);
  }
});
test('autenticación, CSRF y aislamiento se conservan en el servidor real', async () => {
  expect(
    (await new Browser(baseUrl).request(frequencyPath(), 'PATCH', { status: 'INACTIVE' })).status,
  ).toBe(401);
  expect((await admin.request(frequencyPath(), 'PATCH', { status: 'INACTIVE' }, '')).status).toBe(
    403,
  );
  expect((await customer.request(frequencyPath(), 'PATCH', { status: 'INACTIVE' })).status).toBe(
    403,
  );
  expect(
    (
      await admin.request(`/api/v1/frequencies/${randomUUID()}/status`, 'PATCH', {
        status: 'INACTIVE',
      })
    ).status,
  ).toBe(404);
});
test('la baja espera el bloqueo de publicación antes de decidir', async () => {
  const client = await pool.connect();
  let pending;
  try {
    await client.query('BEGIN');
    await policy().forTransaction(client).lock();
    pending = deactivate();
    let waiting = false;
    for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
      const { rows } = await pool.query(
        "SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND objid=1793650000 AND NOT granted) AS waiting",
      );
      waiting = rows[0].waiting;
      if (!waiting) await delay(20);
    }
    expect(waiting).toBe(true);
    expect(
      (await pool.query('SELECT status FROM frequencies WHERE id=$1', [fixture.frequencies[0].id]))
        .rows[0].status,
    ).toBe('ACTIVE');
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
  expect((await pending).status).toBe(409);
});
