const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { start } = require('../../../src/server');
const { createHasher } = require('../../../src/modules/auth/infrastructure/password-hasher');
const { createFleetModule } = require('../../../src/modules/fleet');
const { createFrequenciesModule } = require('../../../src/modules/frequencies');
const PgBusRepository = require('../../../src/modules/fleet/infrastructure/pg-bus.repository');
const { runMigration } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { fleetFixtures, busRequest } = require('../../helpers/fleet-bus');
const makeFixture = require('../../helpers/route-programming');
const Browser = require('../../helpers/session-browser');
const { createRouteSheetsModule } = require('../../../src/modules/route-sheets');
const createQueries = require('../../../src/modules/route-sheets/application/create-trip-queries');
const TripRepository = require('../../../src/modules/route-sheets/infrastructure/repositories/pg-commercial-trip-query-repository');

function publicQueries() {
  return createRouteSheetsModule({
    pool,
    auth,
    frequencyQueries,
    busQueries,
    seatQueries,
    busGroupQueries: createFleetModule({ pool, auth, env: { NODE_ENV: 'test' } }).busGroupQueries,
  }).tripQueries;
}
function timedQueries(now) {
  return createQueries({
    tripRepository: new TripRepository(pool),
    frequencyQueryPort: frequencyQueries,
    busQueryPort: busQueries,
    now: () => now,
  });
}
async function publishedTrip() {
  const response = await publish();
  expect(response.status).toBe(200);
  return (await response.json()).routeSheet.commercial.tripIds[0];
}

const PASSWORD = 'viajes solo pruebas 2030';
const TABLES = [
  'route_sheet_trips',
  'route_sheet_commercial_inventories',
  'route_sheet_commercial_cycles',
  'route_sheet_commercial_series',
];
const pass = (_req, _res, next) => next();
const auth = { authenticate: pass, authorize: () => pass, csrfProtection: pass };
let pool,
  server,
  url,
  hash,
  admin,
  owner,
  bus,
  f,
  signals,
  seatQueries,
  busQueries,
  frequencyQueries;

async function freePort() {
  const s = http.createServer();
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const port = s.address().port;
  await new Promise((r) => s.close(r));
  return port;
}
const endpoint = (sheet, suffix) => `/api/v1/route-sheets/${sheet.context.routeSheetId}/${suffix}`;
const publish = (sheet = f, body = {}) => admin.request(endpoint(sheet, 'publish'), 'POST', body);
async function sheetRow(sheet = f) {
  return (await pool.query('SELECT * FROM route_sheets WHERE id=$1', [sheet.context.routeSheetId]))
    .rows[0];
}
async function count(table) {
  return (await pool.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n;
}

async function preparedSheet(
  date,
  { reuse = f, client = admin, cooperative = owner, busId = bus.id } = {},
) {
  const data = makeFixture({ ...cooperative, busId, date });
  if (reuse) {
    data.frequencies = reuse.frequencies;
    data.body.programming.requiredServices.forEach((v, i) => {
      v.frequencyId = data.frequencies[i].id;
    });
    data.body.programming.agendas[0].activities.forEach((v, i) => {
      v.frequencyId = data.frequencies[i].id;
    });
  } else
    for (const v of data.frequencies)
      await pool.query(
        'INSERT INTO frequencies(id,cooperative_id,origin,destination,departure_time,ant_resolution_number) VALUES($1,$2,$3,$4,$5,$6)',
        [v.id, data.cooperativeId, v.origin, v.destination, v.departureTime, v.antResolutionNumber],
      );
  const created = await client.request('/api/v1/route-sheets', 'POST', {
    busGroupId: data.busGroupId,
    routeDate: date,
  });
  expect(created.status).toBe(201);
  data.context.routeSheetId = (await created.json()).routeSheet.id;
  expect((await client.request(endpoint(data, 'programming'), 'PUT', data.body)).status).toBe(200);
  expect(
    (
      await client.request(endpoint(data, 'tariff'), 'PUT', {
        expectedRevision: 0,
        policy: {
          vipSurchargeBps: 2500,
          minorDiscountBps: 5000,
          seniorDiscountBps: 5000,
          disabilityDiscountBps: 5000,
        },
        frequencies: data.frequencies.map((v) => ({
          frequencyId: v.id,
          prices: [{ fromPosition: 0, toPosition: 1, amountCents: 450 }],
        })),
      })
    ).status,
  ).toBe(200);
  return data;
}

beforeAll(async () => {
  runMigration();
  hash = await (await createHasher()).hash(PASSWORD);
  signals = new Map(['SIGINT', 'SIGTERM'].map((s) => [s, process.listeners(s)]));
  const running = await start({
    DATABASE_URL: assertTestDatabase(),
    JWT_SECRET: 'commercial-trips-test-only-secret-123456789012345',
    NODE_ENV: 'test',
    PORT: String(await freePort()),
  });
  pool = running.pool;
  server = running.server;
  url = `http://127.0.0.1:${server.address().port}`;
  const fleet = createFleetModule({ pool, auth, env: { NODE_ENV: 'test' } });
  seatQueries = fleet.seatQueries;
  busQueries = fleet.busQueries;
  frequencyQueries = createFrequenciesModule({ pool, auth }).frequencyQueries;
});
beforeEach(async () => {
  assertTestDatabase();
  await pool.query('TRUNCATE cooperatives,users,auth_sessions CASCADE');
  const owners = await fleetFixtures(pool);
  owner = owners.first;
  bus = await new PgBusRepository(pool).create(busRequest(owner));
  const actor = (
    await pool.query(
      "INSERT INTO users(email,password_hash,role,cooperative_id) VALUES('trip-admin@example.ec',$1,'COOPERATIVE_ADMIN',$2) RETURNING id",
      [hash, owner.cooperativeId],
    )
  ).rows[0].id;
  admin = new Browser(url);
  await admin.login('trip-admin@example.ec', PASSWORD);
  f = undefined;
  f = await preparedSheet('2030-01-01', { reuse: null });
  f.context.modifiedBy = actor;
});
afterAll(async () => {
  if (server) await new Promise((r) => server.close(r));
  if (pool) await pool.end();
  for (const [s, previous] of signals ?? [])
    for (const listener of process.listeners(s))
      if (!previous.includes(listener)) process.removeListener(s, listener);
});

test('API pública usa proveedores reales y no expone GET de viajes', async () => {
  const tripId = await publishedTrip();
  const dto = await publicQueries().findBookableForSegment({
    tripId,
    fromPosition: 0,
    toPosition: 1,
  });
  expect(dto).toMatchObject({
    tripId,
    cooperativeId: owner.cooperativeId,
    frequencyId: f.frequencies[0].id,
    busId: bus.id,
    amountCents: 450,
    currency: 'USD',
    policy: { vipSurchargeBps: 2500 },
  });
  expect(dto.tripId).not.toBe(dto.frequencyId);
  expect(dto.seatIds.length).toBeGreaterThan(0);
  expect(dto.confirmedThroughExclusive).toBe('2030-01-02T05:00:00.000Z');
  expect((await admin.request(`/api/v1/trips/${tripId}`, 'GET')).status).toBe(404);
  expect(await publicQueries().findBookableById(randomUUID())).toBeNull();
});
test('cierre exacto de embarque y lecturas sin escrituras', async () => {
  const tripId = await publishedTrip();
  const before = await Promise.all(TABLES.map(count));
  expect(await timedQueries('2030-01-01T11:59:59.999Z').findBookableById(tripId)).not.toBeNull();
  expect(await timedQueries('2030-01-01T12:00:00.000Z').findBookableById(tripId)).toBeNull();
  expect(await Promise.all(TABLES.map(count))).toEqual(before);
});
test('asientos congelados sobreviven cambios de fuente; frecuencia inactiva impide compra', async () => {
  const tripId = await publishedTrip();
  const queries = publicQueries();
  const original = await queries.findBookableById(tripId);
  const source = await seatQueries.listByBus({ busId: bus.id, cooperativeId: owner.cooperativeId });
  const changedSource = jest.spyOn(seatQueries, 'listByBus').mockResolvedValue({
    ...source,
    seats: source.seats.map((seat) => ({ ...seat, offered: false })),
  });
  try {
    expect((await queries.findBookableById(tripId)).seatIds).toEqual(original.seatIds);
    expect(changedSource).not.toHaveBeenCalled();
  } finally {
    changedSource.mockRestore();
  }
  await pool.query("UPDATE frequencies SET status='INACTIVE' WHERE id=$1", [f.frequencies[0].id]);
  expect(await queries.findBookableById(tripId)).toBeNull();
});
test('segundo ciclo publicado amplía horizonte; borrador no lo amplía', async () => {
  const tripId = await publishedTrip();
  const manifest = (await sheetRow()).id;
  const next = await preparedSheet('2030-01-02');
  expect((await publicQueries().findBookableById(tripId)).confirmedThroughExclusive).toBe(
    '2030-01-02T05:00:00.000Z',
  );
  const series = (
    await pool.query(
      'SELECT series_id FROM route_sheet_commercial_cycles WHERE route_sheet_id=$1',
      [manifest],
    )
  ).rows[0].series_id;
  expect((await publish(next, { seriesId: series })).status).toBe(200);
  expect((await publicQueries().findBookableById(tripId)).confirmedThroughExclusive).toBe(
    '2030-01-03T05:00:00.000Z',
  );
});
test('error dentro del snapshot hace rollback y libera conexión', async () => {
  const tripId = await publishedTrip();
  const repo = new TripRepository(pool),
    error = new Error('lectura interrumpida');
  await expect(
    repo.withSnapshot(tripId, async () => {
      throw error;
    }),
  ).rejects.toBe(error);
  await expect(
    repo.withSnapshot(tripId, async () => pool.query('SELECT 1 AS ok')),
  ).resolves.toMatchObject({ rows: [{ ok: 1 }] });
});

test('consultas paralelas liberan su snapshot antes de consultar otros módulos', async () => {
  const tripId = await publishedTrip();
  const queries = publicQueries();
  const results = await Promise.all(
    Array.from({ length: 12 }, () => queries.findBookableById(tripId)),
  );
  expect(results).toHaveLength(12);
  expect(results.every((dto) => dto.tripId === tripId)).toBe(true);
});

test('búsqueda nocturna usa la fecha local de cada embarque y su tarifa explícita', async () => {
  const frequencyId = randomUUID();
  await pool.query(
    "INSERT INTO frequencies(id,cooperative_id,origin,destination,departure_time,ant_resolution_number) VALUES($1,$2,'Ambato','Latacunga','23:00','ANT-NOCTURNA-QA')",
    [frequencyId, owner.cooperativeId],
  );
  await pool.query(
    "INSERT INTO frequency_stops(frequency_id,position,place) VALUES($1,0,'Salcedo')",
    [frequencyId],
  );
  const activity = {
    id: randomUUID(),
    kind: 'SERVICE',
    frequencyId,
    requiredServiceId: randomUUID(),
    departureAt: '2030-01-01T23:00:00-05:00',
    arrivalAt: '2030-01-02T02:00:00-05:00',
    preparationMinutes: 15,
    points: [
      { position: 0, departureAt: '2030-01-01T23:00:00-05:00' },
      {
        position: 1,
        arrivalAt: '2030-01-02T00:15:00-05:00',
        departureAt: '2030-01-02T00:20:00-05:00',
      },
      { position: 2, arrivalAt: '2030-01-02T02:00:00-05:00' },
    ],
  };
  const programming = {
    ...f.body.programming,
    cycleLengthDays: 2,
    requiredServices: [
      { id: activity.requiredServiceId, frequencyId, departureAt: activity.departureAt },
    ],
    agendas: [
      {
        ...f.body.programming.agendas[0],
        activities: [
          activity,
          {
            id: randomUUID(),
            kind: 'TRANSFER',
            originKey: 'Latacunga',
            destinationKey: 'Ambato',
            departureAt: '2030-01-02T02:15:00-05:00',
            arrivalAt: '2030-01-02T04:00:00-05:00',
            preparationMinutes: 0,
          },
        ],
      },
    ],
  };
  expect(
    (
      await admin.request(endpoint(f, 'programming'), 'PUT', {
        expectedRevision: 1,
        programming,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await admin.request(endpoint(f, 'tariff'), 'PUT', {
        expectedRevision: 1,
        policy: {
          vipSurchargeBps: 0,
          minorDiscountBps: 0,
          seniorDiscountBps: 0,
          disabilityDiscountBps: 0,
        },
        frequencies: [
          {
            frequencyId,
            prices: [
              { fromPosition: 0, toPosition: 1, amountCents: 200 },
              { fromPosition: 0, toPosition: 2, amountCents: 999 },
              { fromPosition: 1, toPosition: 2, amountCents: 250 },
            ],
          },
        ],
      })
    ).status,
  ).toBe(200);

  const search = async (date, origin = 'Salcedo') => {
    const response = await new Browser(url).request(
      `/api/v1/trips?origin=${origin}&destination=Latacunga&date=${date}`,
    );
    expect(response.status).toBe(200);
    return response.json();
  };
  const empty = { trips: [], truncated: false };
  expect(await search('2030-01-02')).toEqual(empty);
  const tripId = await publishedTrip();
  const before = await Promise.all(TABLES.map(count));
  expect(await search('2030-01-01')).toEqual(empty);
  expect(await search('2030-01-02', 'Ambato')).toEqual(empty);
  expect(await search('2030-01-02')).toMatchObject({
    truncated: false,
    trips: [
      expect.objectContaining({
        tripId,
        fromPosition: 1,
        toPosition: 2,
        boardingAt: '2030-01-02T05:20:00.000Z',
        arrivalAt: '2030-01-02T07:00:00.000Z',
        amountCents: 250,
      }),
    ],
  });
  expect(await search('2030-01-01', 'Ambato')).toMatchObject({
    truncated: false,
    trips: [
      expect.objectContaining({
        tripId,
        fromPosition: 0,
        toPosition: 2,
        boardingAt: '2030-01-02T04:00:00.000Z',
        amountCents: 999,
      }),
    ],
  });
  expect(await Promise.all(TABLES.map(count))).toEqual(before);
  await pool.query("UPDATE frequencies SET status='INACTIVE' WHERE id=$1", [frequencyId]);
  expect(await search('2030-01-02')).toEqual(empty);
});
