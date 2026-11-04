const http = require('node:http');
jest.mock('../../../src/modules/fleet', () => {
  const actual = jest.requireActual('../../../src/modules/fleet');
  return { ...actual, createFleetModule: jest.fn(actual.createFleetModule) };
});
const { randomUUID } = require('node:crypto');
const { start } = require('../../../src/server');
const { createHasher } = require('../../../src/modules/auth/infrastructure/password-hasher');
const { createFleetModule } = require('../../../src/modules/fleet');
const { createFrequenciesModule } = require('../../../src/modules/frequencies');
const PgBusRepository = require('../../../src/modules/fleet/infrastructure/pg-bus.repository');
const PgTariffRepository = require('../../../src/modules/route-sheets/infrastructure/repositories/pg-route-sheet-tariff-repository');
const publishFactory = require('../../../src/modules/route-sheets/application/use-cases/publish-route-sheet.use-case');
const { runMigration } = require('../../helpers/database');
const { rollbackBefore } = require('../../helpers/migration-target');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { fleetFixtures, busRequest } = require('../../helpers/fleet-bus');
const makeFixture = require('../../helpers/route-programming');
const Browser = require('../../helpers/session-browser');

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
  otherOwner,
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
  seatQueries = createFleetModule.mock.results.at(-1).value.seatQueries;
  server = running.server;
  url = `http://127.0.0.1:${server.address().port}`;
  const fleet = createFleetModule({ pool, auth, env: { NODE_ENV: 'test' } });
  busQueries = fleet.busQueries;
  frequencyQueries = createFrequenciesModule({ pool, auth }).frequencyQueries;
});
beforeEach(async () => {
  jest.restoreAllMocks();
  assertTestDatabase();
  await pool.query('TRUNCATE cooperatives,users,auth_sessions CASCADE');
  const owners = await fleetFixtures(pool);
  owner = owners.first;
  otherOwner = owners.second;
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

test('borrador no genera viajes; publicar crea tres IDs propios y una copia por bus', async () => {
  for (const table of TABLES) expect(await count(table)).toBe(0);
  const response = await publish();
  expect(response.status).toBe(200);
  const result = (await response.json()).routeSheet;
  expect(result.commercial.tripIds).toHaveLength(3);
  expect(result.commercial.cycleNumber).toBe(1);
  const trips = (await pool.query('SELECT * FROM route_sheet_trips ORDER BY departure_at')).rows;
  expect(trips.map((t) => t.id)).toEqual(result.commercial.tripIds);
  trips.forEach((t, i) => {
    expect(t.id).not.toBe(t.frequency_id);
    expect(t.id).not.toBe(t.assignment_id);
    expect(t).toMatchObject({
      cooperative_id: owner.cooperativeId,
      route_sheet_id: f.context.routeSheetId,
      bus_id: bus.id,
      frequency_id: f.frequencies[i].id,
      programming_revision: 1,
      tariff_revision: 1,
    });
    expect(t.route_points[0].position).toBe(0);
    expect(t.route_points[1].position).toBe(1);
  });
  expect(await count('route_sheet_commercial_inventories')).toBe(1);
  const inventory = (await pool.query('SELECT * FROM route_sheet_commercial_inventories')).rows[0];
  expect(inventory.snapshot.seats.map((s) => s.seatId)).toEqual(
    (await seatQueries.listByBus({ busId: bus.id, cooperativeId: owner.cooperativeId })).seats
      .filter((s) => s.offered)
      .map((s) => s.seatId),
  );
  expect(inventory).toMatchObject({
    revision: 1,
    schema_version: 1,
    captured_by: f.context.modifiedBy,
  });
});

test('reintentos simultáneos conservan identidad, actor, fecha y copia sin recaptura', async () => {
  const responses = await Promise.all([publish(), publish()]);
  expect(responses.map((r) => r.status)).toEqual([200, 200]);
  const first = (await responses[0].json()).routeSheet,
    second = (await responses[1].json()).routeSheet;
  expect(second.commercial).toEqual(first.commercial);
  const previous = await sheetRow();
  const before = (await pool.query('SELECT * FROM route_sheet_commercial_inventories')).rows[0];
  const source = await seatQueries.listByBus({ busId: bus.id, cooperativeId: owner.cooperativeId });
  const changedSource = jest.spyOn(seatQueries, 'listByBus').mockResolvedValue({
    ...source,
    seats: source.seats.map((seat) => ({ ...seat, offered: false })),
  });
  await pool.query("UPDATE frequencies SET status='INACTIVE' WHERE cooperative_id=$1", [
    owner.cooperativeId,
  ]);
  const replay = await publish();
  expect(replay.status).toBe(200);
  expect((await replay.json()).routeSheet.commercial).toEqual(first.commercial);
  expect((await sheetRow()).published_at).toEqual(previous.published_at);
  expect(changedSource).not.toHaveBeenCalled();
  expect((await pool.query('SELECT * FROM route_sheet_commercial_inventories')).rows[0]).toEqual(
    before,
  );
});

test('captura únicamente asientos ofrecidos', async () => {
  const input = busRequest({ ...owner, data: { plate: 'TBC0026', vin: 'VIN0026', unitNumber: 2 } });
  const disabled = input.configuration.seats.find((seat) => seat.label === 1);
  bus = await new PgBusRepository(pool).create(
    busRequest({
      ...owner,
      data: { ...input.data, disabledSeatKeys: [disabled.layoutSeatKey] },
    }),
  );
  f.body.programming.agendas[0].busId = bus.id;
  expect(
    (
      await admin.request(endpoint(f, 'programming'), 'PUT', {
        ...f.body,
        expectedRevision: 1,
      })
    ).status,
  ).toBe(200);
  expect((await publish()).status).toBe(200);
  const seats = (await pool.query('SELECT snapshot FROM route_sheet_commercial_inventories'))
    .rows[0].snapshot.seats;
  expect(seats).toHaveLength(41);
  expect(seats.some((s) => s.label === 1)).toBe(false);
});

test('inventario vacío no deja publicación, viajes ni serie parciales', async () => {
  const source = await seatQueries.listByBus({ busId: bus.id, cooperativeId: owner.cooperativeId });
  const emptySource = jest.spyOn(seatQueries, 'listByBus').mockResolvedValue({
    ...source,
    seats: source.seats.map((seat) => ({ ...seat, offered: false })),
  });
  const response = await publish();
  expect(response.status).toBe(409);
  expect((await response.json()).error.code).toBe('COMMERCIAL_INVENTORY_EMPTY');
  expect(emptySource).toHaveBeenCalledWith({ busId: bus.id, cooperativeId: owner.cooperativeId });
  for (const table of TABLES) expect(await count(table)).toBe(0);
  expect((await sheetRow()).status).toBe('DRAFT');
  expect((await sheetRow()).tariff_frozen).toBeNull();
});

test('segundo ciclo exige seriesId explícito y conserva asientos con copia propia', async () => {
  const first = (await (await publish()).json()).routeSheet.commercial;
  const second = await preparedSheet('2030-01-02');
  const missing = await publish(second);
  expect(missing.status).toBe(409);
  expect((await missing.json()).error.code).toBe('COMMERCIAL_SERIES_CONFLICT');
  expect((await sheetRow(second)).status).toBe('DRAFT');
  const response = await publish(second, { seriesId: first.seriesId });
  expect(response.status).toBe(200);
  const next = (await response.json()).routeSheet.commercial;
  expect(next.seriesId).toBe(first.seriesId);
  expect(next.cycleNumber).toBe(2);
  expect(next.tripIds.some((id) => first.tripIds.includes(id))).toBe(false);
  const inventories = (
    await pool.query('SELECT * FROM route_sheet_commercial_inventories ORDER BY route_sheet_id')
  ).rows;
  expect(inventories[0].id).not.toBe(inventories[1].id);
  expect(inventories[0].snapshot).toEqual(inventories[1].snapshot);
});

test.each(['gap', 'length'])('rechaza continuación con %s sin generar viajes', async (kind) => {
  const first = (await (await publish()).json()).routeSheet.commercial;
  const next = await preparedSheet(kind === 'gap' ? '2030-01-03' : '2030-01-02');
  if (kind === 'length') {
    next.body.programming.cycleLengthDays = 2;
    expect(
      (
        await admin.request(endpoint(next, 'programming'), 'PUT', {
          ...next.body,
          expectedRevision: 1,
        })
      ).status,
    ).toBe(200);
  }
  const response = await publish(next, { seriesId: first.seriesId });
  expect(response.status).toBe(409);
  expect((await response.json()).error.code).toBe('COMMERCIAL_SERIES_CONFLICT');
  expect(await count('route_sheet_trips')).toBe(3);
});

test('otra cooperativa no puede enlazar su hoja a la serie conocida de un tercero', async () => {
  const first = (await (await publish()).json()).routeSheet.commercial;
  const otherBus = await new PgBusRepository(pool).create(
    busRequest({ ...otherOwner, data: { plate: 'TBC0024', vin: 'VIN0024' } }),
  );
  await pool.query(
    "INSERT INTO users(email,password_hash,role,cooperative_id) VALUES('trip-other@example.ec',$1,'COOPERATIVE_ADMIN',$2)",
    [hash, otherOwner.cooperativeId],
  );
  const client = new Browser(url);
  await client.login('trip-other@example.ec', PASSWORD);
  const other = await preparedSheet('2030-01-01', {
    reuse: null,
    client,
    cooperative: otherOwner,
    busId: otherBus.id,
  });
  const response = await client.request(endpoint(other, 'publish'), 'POST', {
    seriesId: first.seriesId,
  });
  expect(response.status).toBe(409);
  expect((await response.json()).error.code).toBe('COMMERCIAL_SERIES_CONFLICT');
  expect(
    (
      await pool.query('SELECT count(*)::int n FROM route_sheet_trips WHERE cooperative_id=$1', [
        otherOwner.cooperativeId,
      ])
    ).rows[0].n,
  ).toBe(0);
});

test('IDs de serie inválidos y serie distinta en reintento no cambian publicación', async () => {
  expect((await publish(f, { seriesId: 'incorrecto' })).status).toBe(400);
  expect((await publish(f, { seriesId: null })).status).toBe(400);
  const first = await publish();
  expect(first.status).toBe(200);
  const original = await sheetRow();
  expect((await publish(f, { seriesId: randomUUID() })).status).toBe(409);
  expect((await sheetRow()).published_at).toEqual(original.published_at);
});

test.each(TABLES)('SQL no permite mutar ni borrar registro comercial de %s', async (table) => {
  expect((await publish()).status).toBe(200);
  await expect(pool.query(`UPDATE ${table} SET id=id`)).rejects.toMatchObject({ code: '23514' });
  await expect(pool.query(`DELETE FROM ${table}`)).rejects.toMatchObject({ code: '23514' });
});

test('error después de insertar viajes revierte serie, inventario, tarifa y estado', async () => {
  const error = new Error('Fallo ficticio tras inserción de viaje');
  const failingPool = {
    connect: async () => {
      const client = await pool.connect();
      return {
        release: () => client.release(),
        query: async (sql, params) => {
          const result = await client.query(sql, params);
          if (sql.includes('INSERT INTO route_sheet_trips')) throw error;
          return result;
        },
      };
    },
  };
  const pub = publishFactory({
    tariffRepository: new PgTariffRepository(failingPool, {
      frequencySessionFactory: frequencyQueries.forTransaction,
    }),
    busQueryPort: busQueries,
    seatQueryPort: seatQueries,
  });
  await expect(
    pub({
      routeSheetId: f.context.routeSheetId,
      cooperativeId: owner.cooperativeId,
      publishedBy: f.context.modifiedBy,
    }),
  ).rejects.toBe(error);
  for (const table of TABLES) expect(await count(table)).toBe(0);
  expect((await sheetRow()).status).toBe('DRAFT');
  expect((await sheetRow()).tariff_frozen).toBeNull();
  expect((await publish()).status).toBe(200);
});

test('fallo real del proveedor no equivale a asientos disponibles', async () => {
  const pub = publishFactory({
    tariffRepository: new PgTariffRepository(pool, {
      frequencySessionFactory: frequencyQueries.forTransaction,
    }),
    busQueryPort: busQueries,
    seatQueryPort: {
      listByBus: async () => {
        throw new Error('Fuente ficticia no disponible');
      },
    },
  });
  await expect(
    pub({
      routeSheetId: f.context.routeSheetId,
      cooperativeId: owner.cooperativeId,
      publishedBy: f.context.modifiedBy,
    }),
  ).rejects.toMatchObject({ code: 'COMMERCIAL_TRIP_SOURCE_UNAVAILABLE', httpStatus: 503 });
  for (const table of TABLES) expect(await count(table)).toBe(0);
});

test('hoja histórica publicada sin viajes no se reconstruye al reintentar', async () => {
  await pool.query(
    "UPDATE route_sheets SET status='PUBLISHED',published_by=$2,published_at=CURRENT_TIMESTAMP,tariff_frozen=tariff_draft,tariff_frozen_revision=tariff_revision,tariff_frozen_at=CURRENT_TIMESTAMP,tariff_frozen_by=$2 WHERE id=$1",
    [f.context.routeSheetId, f.context.modifiedBy],
  );
  const response = await publish();
  expect(response.status).toBe(200);
  expect((await response.json()).routeSheet.commercial).toBeNull();
  for (const table of TABLES) expect(await count(table)).toBe(0);
});

test('down no destruye información comercial y los reintentos siguen estables', async () => {
  const before = (await (await publish()).json()).routeSheet.commercial;
  const target = '1793730000000-commercial-trips';
  const applied = (await pool.query('SELECT name FROM pgmigrations ORDER BY id DESC')).rows;
  expect(applied.map(({ name }) => name)).toContain(target);
  try {
    for (const { name } of applied) {
      if (name === target) break;
      runMigration('down');
    }
    expect(
      (await pool.query('SELECT name FROM pgmigrations ORDER BY id DESC LIMIT 1')).rows[0].name,
    ).toBe(target);
    expect(() => runMigration('down')).toThrow();
    expect((await (await publish()).json()).routeSheet.commercial).toEqual(before);
  } finally {
    runMigration();
  }
});

test('dos buses capturan dos inventarios y los traslados no crean viajes', async () => {
  const secondBus = await new PgBusRepository(pool).create(
    busRequest({ ...owner, data: { plate: 'TBC0025', vin: 'VIN0025', unitNumber: 2 } }),
  );
  const [first, second, third] = f.body.programming.agendas[0].activities;
  f.body.programming.agendas = [
    {
      busId: bus.id,
      initialAvailability: { availableAt: '2030-01-01T00:00:00-05:00', locationKey: 'Ambato' },
      blocks: [],
      activities: [
        first,
        {
          id: randomUUID(),
          kind: 'TRANSFER',
          originKey: 'Latacunga',
          destinationKey: 'Ambato',
          departureAt: '2030-01-01T08:15:00-05:00',
          arrivalAt: '2030-01-01T09:00:00-05:00',
          preparationMinutes: 15,
        },
      ],
    },
    {
      busId: secondBus.id,
      initialAvailability: { availableAt: '2030-01-01T00:00:00-05:00', locationKey: 'Latacunga' },
      blocks: [],
      activities: [
        second,
        third,
        {
          id: randomUUID(),
          kind: 'TRANSFER',
          originKey: 'Ambato',
          destinationKey: 'Latacunga',
          departureAt: '2030-01-01T13:15:00-05:00',
          arrivalAt: '2030-01-01T14:00:00-05:00',
          preparationMinutes: 15,
        },
      ],
    },
  ];
  expect(
    (await admin.request(endpoint(f, 'programming'), 'PUT', { ...f.body, expectedRevision: 1 }))
      .status,
  ).toBe(200);
  expect((await publish()).status).toBe(200);
  expect(await count('route_sheet_trips')).toBe(3);
  expect(await count('route_sheet_commercial_inventories')).toBe(2);
  expect(
    (await pool.query('SELECT count(DISTINCT bus_id)::int n FROM route_sheet_trips')).rows[0].n,
  ).toBe(2);
});

test('las referencias compuestas no permiten mezclar viaje y ciclo de otra hoja', async () => {
  const manifest = (await (await publish()).json()).routeSheet.commercial;
  const first = (await pool.query('SELECT * FROM route_sheet_trips LIMIT 1')).rows[0];
  const next = await preparedSheet('2030-01-02');
  const service = next.body.programming.agendas[0].activities[0];
  await expect(
    pool.query(
      `INSERT INTO route_sheet_trips(cooperative_id,route_sheet_id,assignment_id,required_service_id,frequency_id,bus_id,cycle_id,inventory_snapshot_id,
    programming_revision,tariff_revision,departure_at,arrival_at,route_points,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,1,$9,$10,$11::jsonb,$12)`,
      [
        owner.cooperativeId,
        next.context.routeSheetId,
        service.id,
        service.requiredServiceId,
        service.frequencyId,
        bus.id,
        manifest.cycleId,
        first.inventory_snapshot_id,
        service.departureAt,
        service.arrivalAt,
        JSON.stringify(service.points),
        f.context.modifiedBy,
      ],
    ),
  ).rejects.toMatchObject({ code: '23503' });
  expect(await count('route_sheet_trips')).toBe(3);
});
