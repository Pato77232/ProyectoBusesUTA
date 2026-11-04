const http = require('node:http');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
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
  const bus = await new PgBusRepository(pool).create(
    busRequest({ ...owner, data: { vipSeatKeys: ['deck-1-0-1'] } }),
  );
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
          minorDiscountBps: 10000,
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
                  { fromPosition: 1, toPosition: 2, amountCents: 300 },
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

const createApp = require('../../../src/app');
const { createAuthModule } = require('../../../src/modules/auth');
const { createFleetModule } = require('../../../src/modules/fleet');
const { createFrequenciesModule } = require('../../../src/modules/frequencies');
const { createRouteSheetsModule } = require('../../../src/modules/route-sheets');
const { createBookingsModule } = require('../../../src/modules/bookings');
function input({ seat = seats[0].seatId, from = 0, to = 2, birthDate = '1990-01-01' } = {}) {
  return {
    tripId,
    fromPosition: from,
    toPosition: to,
    seatIds: [seat],
    passengers: [
      {
        seatId: seat,
        identificationNumber: '0100000009',
        fullName: 'Persona de Prueba',
        birthDate,
      },
    ],
  };
}
async function count() {
  return (
    await pool.query(
      'SELECT (SELECT count(*)::int FROM bookings) AS bookings,(SELECT count(*)::int FROM booking_seat_allocations) AS allocations',
    )
  ).rows[0];
}
async function reserve(browser, body, key = randomUUID()) {
  return fetch(browser.baseUrl + '/api/v1/bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': browser.csrf,
      'Idempotency-Key': key,
      cookie: [...browser.cookies].map(([name, value]) => `${name}=${value}`).join('; '),
    },
    body: JSON.stringify(body),
  });
}
async function accept(browser, body = input()) {
  const response = await browser.request('/api/v1/bookings/summary', 'POST', body);
  expect(response.status).toBe(200);
  const quoted = await response.json();
  return {
    quoted,
    body: { ...body, summaryAccepted: true, acceptedSummaryRevision: quoted.summaryRevision },
  };
}
async function prepared(execute, { birthDateVerified = true } = {}) {
  const env = {
    NODE_ENV: 'test',
    JWT_SECRET: 'compra-comercial-solo-qa-secreto-1234567890',
    BOOKING_EXPIRATION_ENABLED: 'false',
  };
  const auth = await createAuthModule({ pool, env });
  const fleet = createFleetModule({ pool, auth, env });
  const frequencies = createFrequenciesModule({ pool, auth });
  const routeSheets = createRouteSheetsModule({
    pool,
    auth,
    frequencyQueries: frequencies.frequencyQueries,
    busQueries: fleet.busQueries,
    busGroupQueries: fleet.busGroupQueries,
    seatQueries: fleet.seatQueries,
  });
  // Solo la acreditación se sustituye en QA: el flujo humano sigue pendiente.
  const passengerVerifier = {
    verify: jest.fn(async ({ passengers }) =>
      passengers.map(({ seatId }) => ({ seatId, birthDateVerified, disabilityVerified: false })),
    ),
  };
  const bookings = createBookingsModule({
    pool,
    auth,
    env,
    availabilityQueries: routeSheets.tripQueries,
    passengerVerifier,
  });
  const server = http.createServer(createApp({ auth, bookings, pool }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const browser = new Browser(`http://127.0.0.1:${server.address().port}`);
    await browser.login('availability-customer@example.ec', PASSWORD);
    return await execute(browser, passengerVerifier);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
test('producción mantiene la compra bloqueada sin acreditación y no escribe reservas', async () => {
  const response = await customer.request('/api/v1/bookings/summary', 'POST', input());
  expect(response.status).toBe(503);
  expect((await response.json()).error.code).toBe('BOOKING_BENEFIT_SERVICE_UNAVAILABLE');
  expect(await count()).toEqual({ bookings: 0, allocations: 0 });
});
test('la integración preparada usa tarifa explícita y persiste referencias comerciales y propietario real', async () => {
  await prepared(async (browser, verifier) => {
    const { quoted, body } = await accept(browser);
    expect(quoted.summary.totals.totalPriceCents).toBe(450);
    expect(quoted.summary.schemaVersion).toBe(2);
    expect(quoted.summary.commercial).toMatchObject({
      unitPriceCents: 450,
      inventoryRevision: 1,
      tariffRevision: 1,
    });
    const response = await reserve(browser, body);
    expect(response.status).toBe(201);
    const booking = (await response.json()).booking;
    const row = (await pool.query('SELECT * FROM bookings WHERE id=$1', [booking.bookingId]))
      .rows[0];
    expect(row.summary).toEqual(quoted.summary);
    expect(row.cooperative_id).toBe(owner.cooperativeId);
    expect(row.vip_surcharge_cents).toBe('0');
    expect(verifier.verify).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId,
        cooperativeId: owner.cooperativeId,
        fromPosition: 0,
        toPosition: 2,
        ownerId: row.owner_id,
      }),
    );
  });
});
test('solapamiento concurrente reserva una sola vez y el reintento recupera el mismo resultado', async () => {
  await prepared(async (browser) => {
    const { body } = await accept(browser);
    const keys = [randomUUID(), randomUUID()];
    const responses = await Promise.all(keys.map((key) => reserve(browser, body, key)));
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const index = responses.findIndex((response) => response.status === 201);
    const saved = (await responses[index].json()).booking;
    expect((await (await reserve(browser, body, keys[index])).json()).booking).toEqual(saved);
    expect(await count()).toEqual({ bookings: 1, allocations: 1 });
  });
});
test('la adyacencia permite reutilizar asiento, el par completo se mantiene ocupado', async () => {
  await prepared(async (browser) => {
    for (const [from, to] of [
      [0, 1],
      [1, 2],
    ]) {
      const { body } = await accept(browser, input({ from, to }));
      expect((await reserve(browser, body)).status).toBe(201);
    }
    const { body } = await accept(browser);
    expect((await reserve(browser, body)).status).toBe(409);
    expect(await count()).toEqual({ bookings: 2, allocations: 2 });
  });
});
test('resumen alterado revierte toda escritura y exige nueva aceptación', async () => {
  await prepared(async (browser) => {
    const { body } = await accept(browser);
    const response = await reserve(browser, { ...body, acceptedSummaryRevision: '0'.repeat(64) });
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe('BOOKING_SUMMARY_CHANGED');
    expect(await count()).toEqual({ bookings: 0, allocations: 0 });
  });
});
test('fecha no acreditada bloquea el total incluso para una persona adulta', async () => {
  await prepared(
    async (browser) => {
      const response = await browser.request('/api/v1/bookings/summary', 'POST', input());
      expect(response.status).toBe(409);
      expect((await response.json()).error.code).toBe('BOOKING_BENEFIT_REVIEW_REQUIRED');
      expect(await count()).toEqual({ bookings: 0, allocations: 0 });
    },
    { birthDateVerified: false },
  );
});
test('total cero se cotiza y su confirmación se bloquea sin comprobante ni reserva ficticios', async () => {
  await prepared(async (browser) => {
    const { quoted, body } = await accept(browser, input({ birthDate: '2015-01-01' }));
    expect(quoted.summary.totals.totalPriceCents).toBe(0);
    const response = await reserve(browser, body);
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe('BOOKING_ZERO_TOTAL_UNSUPPORTED');
    expect(await count()).toEqual({ bookings: 0, allocations: 0 });
  });
});

test('VIP congelado y descuento conservan fracciones, ajuste y reversión segura de la migración', async () => {
  await prepared(async (browser) => {
    const { quoted, body } = await accept(
      browser,
      input({ seat: seats[1].seatId, birthDate: '1960-01-01' }),
    );
    expect(quoted.summary.passengers[0].seatCategory).toBe('VIP');
    expect(quoted.summary.totals).toMatchObject({
      basePriceCents: 450,
      vipSurchargeCents: 113,
      discountCents: 281,
      roundingAdjustmentCents: -1,
      totalPriceCents: 281,
    });
    const response = await reserve(browser, body);
    expect(response.status).toBe(201);
    const booking = (await response.json()).booking;
    const saved = (
      await pool.query(
        'SELECT vip_surcharge_cents,rounding_adjustment_cents,total_price_cents FROM bookings WHERE id=$1',
        [booking.bookingId],
      )
    ).rows[0];
    expect(saved).toEqual({
      vip_surcharge_cents: '113',
      rounding_adjustment_cents: '-1',
      total_price_cents: '281',
    });
    const before = (await pool.query('SELECT name FROM pgmigrations ORDER BY id')).rows;
    const failure = JSON.parse(
      execFileSync(
        process.execPath,
        [
          path.join(__dirname, '../../helpers/migration-worker.js'),
          'migrate',
          JSON.stringify({ direction: 'down' }),
        ],
        { env: process.env, encoding: 'utf8' },
      ),
    );
    expect(failure.error.message).toContain(
      'Los importes comerciales requieren un plan de reversión',
    );
    expect((await pool.query('SELECT name FROM pgmigrations ORDER BY id')).rows).toEqual(before);
    expect(
      (
        await pool.query(
          'SELECT vip_surcharge_cents,rounding_adjustment_cents,total_price_cents FROM bookings WHERE id=$1',
          [booking.bookingId],
        )
      ).rows[0],
    ).toEqual(saved);
  });
});
