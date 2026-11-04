const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { start } = require('../../../src/server');
const { createHasher } = require('../../../src/modules/auth/infrastructure/password-hasher');
const { createFleetModule } = require('../../../src/modules/fleet');
const { createFrequenciesModule } = require('../../../src/modules/frequencies');
const PgBusRepository = require('../../../src/modules/fleet/infrastructure/pg-bus.repository');
const PgRenewalRepository = require('../../../src/modules/route-sheets/infrastructure/repositories/pg-route-sheet-renewal-repository');
const prepareRenewalFactory = require('../../../src/modules/route-sheets/application/use-cases/prepare-route-sheet-renewal.use-case');
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

const request = () => ({
  expectedProgrammingRevision: 1,
  expectedTariffRevision: 1,
  requestKey: randomUUID(),
});
const renew = (body, sheet = f) => admin.request(endpoint(sheet, 'renewals'), 'POST', body);
async function publishedSource() {
  const response = await publish();
  expect(response.status).toBe(200);
  return (await response.json()).routeSheet;
}

test('prepara una copia íntegra sin viajes y publica en la serie original', async () => {
  const source = await publishedSource();
  const original = (await pool.query('SELECT * FROM route_sheet_trips ORDER BY id')).rows;
  const body = request();
  const response = await renew(body);
  expect(response.status).toBe(201);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const result = await response.json();
  expect(result).toMatchObject({
    replayed: false,
    renewal: {
      sourceRouteSheetId: f.context.routeSheetId,
      seriesId: source.commercial.seriesId,
      status: 'DRAFT',
      programmingRevision: 1,
      tariffRevision: 1,
      startAt: '2030-01-02T05:00:00.000Z',
      endExclusive: '2030-01-03T05:00:00.000Z',
      createdBy: f.context.modifiedBy,
    },
  });
  expect(await count('route_sheet_trips')).toBe(3);
  const target = result.renewal.routeSheetId;
  const sheets = (await pool.query('SELECT * FROM route_sheets ORDER BY route_date')).rows;
  expect(sheets[1].tariff_draft).toEqual(sheets[0].tariff_frozen);
  const records = (
    await pool.query(
      'SELECT route_sheet_id,id,required_service_id FROM route_sheet_assignments ORDER BY route_sheet_id,id',
    )
  ).rows;
  const sourceIds = records
    .filter((r) => r.route_sheet_id === f.context.routeSheetId)
    .flatMap((r) => [r.id, r.required_service_id]);
  records
    .filter((r) => r.route_sheet_id === target)
    .forEach((r) => {
      expect(sourceIds).not.toContain(r.id);
      expect(sourceIds).not.toContain(r.required_service_id);
    });
  const published = await admin.request(`/api/v1/route-sheets/${target}/publish`, 'POST', {
    expectedRevision: 1,
    expectedProgrammingRevision: 1,
  });
  expect(published.status).toBe(200);
  expect((await published.json()).routeSheet.commercial).toMatchObject({
    seriesId: source.commercial.seriesId,
    cycleNumber: 2,
  });
  expect(
    (
      await pool.query('SELECT * FROM route_sheet_trips WHERE route_sheet_id=$1 ORDER BY id', [
        f.context.routeSheetId,
      ])
    ).rows,
  ).toEqual(original);
  const replay = await renew(body);
  expect(replay.status).toBe(200);
  expect(await replay.json()).toEqual({ ...result, replayed: true });
  expect(await count('route_sheet_renewals')).toBe(1);
});

test('serializa reintentos simultáneos y rechaza claves distintas para el mismo destino', async () => {
  await publishedSource();
  const body = request();
  const responses = await Promise.all([renew(body), renew(body)]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 201]);
  const results = await Promise.all(responses.map((r) => r.json()));
  expect(results[0].renewal).toEqual(results[1].renewal);
  expect((await renew(request())).status).toBe(409);
  expect((await renew({ ...body, expectedTariffRevision: 2 })).status).toBe(409);
  expect(await count('route_sheets')).toBe(2);
  expect(await count('route_sheet_renewals')).toBe(1);
});

test('dos claves concurrentes no crean dos borradores ni consumen tres ciclos', async () => {
  await publishedSource();
  const responses = await Promise.all([renew(request()), renew(request())]);
  expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
  const target = (await responses.find((r) => r.status === 201).json()).renewal.routeSheetId;
  expect((await admin.request(`/api/v1/route-sheets/${target}/publish`, 'POST', {})).status).toBe(
    200,
  );
  expect((await renew(request(), { context: { routeSheetId: target } })).status).toBe(409);
  expect(await count('route_sheets')).toBe(2);
});

test('rechaza serie ajena al publicar y conserva el borrador sin viajes', async () => {
  await publishedSource();
  const target = (await (await renew(request())).json()).renewal.routeSheetId;
  const response = await admin.request(`/api/v1/route-sheets/${target}/publish`, 'POST', {
    seriesId: randomUUID(),
  });
  expect(response.status).toBe(409);
  expect(await count('route_sheet_trips')).toBe(3);
});

test('editar la tarifa del destino conserva el origen y publica la nueva revisión', async () => {
  await publishedSource();
  const source = (
    await pool.query('SELECT tariff_frozen FROM route_sheets WHERE id=$1', [f.context.routeSheetId])
  ).rows[0].tariff_frozen;
  const target = (await (await renew(request())).json()).renewal.routeSheetId;
  const { vipSurchargeBps, minorDiscountBps, seniorDiscountBps, disabilityDiscountBps } =
    source.policy;
  expect(
    (
      await admin.request(`/api/v1/route-sheets/${target}/tariff`, 'PUT', {
        expectedRevision: 1,
        policy: { vipSurchargeBps, minorDiscountBps, seniorDiscountBps, disabilityDiscountBps },
        frequencies: source.frequencies.map(({ frequencyId, prices }) => ({
          frequencyId,
          prices: prices.map((p) => ({ ...p, amountCents: 999 })),
        })),
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await admin.request(`/api/v1/route-sheets/${target}/publish`, 'POST', {
        expectedRevision: 1,
        expectedProgrammingRevision: 1,
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await admin.request(`/api/v1/route-sheets/${target}/publish`, 'POST', {
        expectedRevision: 2,
        expectedProgrammingRevision: 1,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await pool.query('SELECT tariff_frozen FROM route_sheets WHERE id=$1', [
        f.context.routeSheetId,
      ])
    ).rows[0].tariff_frozen,
  ).toEqual(source);
  const targetTariff = (
    await pool.query('SELECT tariff_frozen FROM route_sheets WHERE id=$1', [target])
  ).rows[0].tariff_frozen;
  expect(targetTariff.frequencies[0].prices[0].amountCents).toBe(999);
});

test('editar la duración del borrador no permite cambiar el intervalo vinculado al publicar', async () => {
  await publishedSource();
  const target = (await (await renew(request())).json()).renewal.routeSheetId;
  const {
    readProgramming,
  } = require('../../../src/modules/route-sheets/infrastructure/repositories/programming-records');
  const {
    canonicalProgramming,
  } = require('../../../src/modules/route-sheets/infrastructure/repositories/renewal-records');
  const record = await readProgramming(pool, target, owner.cooperativeId);
  const tariff = (await pool.query('SELECT tariff_draft FROM route_sheets WHERE id=$1', [target]))
    .rows[0].tariff_draft;
  const programming = canonicalProgramming(record.programming, tariff);
  programming.cycleLengthDays = 2;
  expect(
    (
      await admin.request(`/api/v1/route-sheets/${target}/programming`, 'PUT', {
        expectedRevision: 1,
        programming,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await admin.request(`/api/v1/route-sheets/${target}/publish`, 'POST', {
        expectedRevision: 1,
        expectedProgrammingRevision: 2,
      })
    ).status,
  ).toBe(409);
  expect(await count('route_sheet_trips')).toBe(3);
});

test('autorización, tenant, CSRF, origen y revisiones no se eluden con la clave', async () => {
  expect((await renew(request())).status).toBe(409);
  await publishedSource();
  expect((await admin.request(endpoint(f, 'renewals'), 'POST', request(), '')).status).toBe(403);
  expect((await renew({ ...request(), expectedProgrammingRevision: 2 })).status).toBe(409);
  expect((await renew({ ...request(), cooperativeId: otherOwner.cooperativeId })).status).toBe(400);
  expect((await renew(request(), { context: { routeSheetId: randomUUID() } })).status).toBe(404);
  expect(
    (
      await fetch(`${url}${endpoint(f, 'renewals')}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request()),
      })
    ).status,
  ).toBe(401);
  expect(await count('route_sheet_renewals')).toBe(0);
});

test('otra cooperativa no puede renovar el origen ni recuperar una clave ajena', async () => {
  await publishedSource();
  const body = request();
  expect((await renew(body)).status).toBe(201);
  await pool.query(
    "INSERT INTO users(email,password_hash,role,cooperative_id) VALUES('other-renewal@example.ec',$1,'COOPERATIVE_ADMIN',$2)",
    [hash, otherOwner.cooperativeId],
  );
  const other = new Browser(url);
  await other.login('other-renewal@example.ec', PASSWORD);
  expect((await other.request(endpoint(f, 'renewals'), 'POST', body)).status).toBe(404);
  expect(await count('route_sheet_renewals')).toBe(1);
});

test('la procedencia no se edita, borra ni destruye con down', async () => {
  await publishedSource();
  const target = (await (await renew(request())).json()).renewal.routeSheetId;
  await expect(
    pool.query('UPDATE route_sheet_renewals SET series_id=$1 WHERE target_route_sheet_id=$2', [
      randomUUID(),
      target,
    ]),
  ).rejects.toMatchObject({ code: '23514' });
  await expect(
    pool.query('DELETE FROM route_sheet_renewals WHERE target_route_sheet_id=$1', [target]),
  ).rejects.toMatchObject({ code: '23514' });
  // Retira por nombre las migraciones posteriores para comprobar el down de la renovación.
  await rollbackBefore(pool, '1794160000000-route-sheet-renewals');
  try {
    expect(() => runMigration('down')).toThrow();
    expect(await count('route_sheet_renewals')).toBe(1);
  } finally {
    runMigration();
  }
});

test('un commit con respuesta perdida se recupera por clave desde otra instancia y otro reloj', async () => {
  await publishedSource();
  const body = { ...request(), sourceRouteSheetId: f.context.routeSheetId };
  const actor = {
    id: f.context.modifiedBy,
    cooperative_id: owner.cooperativeId,
    role: 'COOPERATIVE_ADMIN',
  };
  const uncertainPool = {
    connect: async () => {
      const client = await pool.connect();
      return {
        release: () => client.release(),
        query: async (sql, values) => {
          const result = await client.query(sql, values);
          if (sql === 'COMMIT') throw new Error('respuesta de commit perdida');
          return result;
        },
      };
    },
  };
  const build = (database, now) =>
    prepareRenewalFactory({
      renewalRepository: new PgRenewalRepository(database, {
        frequencySessionFactory: frequencyQueries.forTransaction,
      }),
      busQueryPort: busQueries,
      now,
      newId: randomUUID,
    });
  await expect(
    build(uncertainPool, () => '2029-12-31T00:00:00.000Z')(body, actor),
  ).rejects.toMatchObject({ code: 'ROUTE_RENEWAL_RESULT_UNCERTAIN', httpStatus: 503 });
  const recovered = await build(pool, () => {
    throw new Error('no debe consultar reloj');
  })(body, actor);
  expect(recovered.replayed).toBe(true);
  expect(recovered.renewal.createdAt).toBe('2029-12-31T00:00:00.000Z');
  expect(await count('route_sheets')).toBe(2);
  expect(await count('route_sheet_renewals')).toBe(1);
});

test('un proveedor vigente inválido impide preparar y el replay no lo recaptura', async () => {
  await publishedSource();
  await pool.query("UPDATE frequencies SET status='INACTIVE' WHERE cooperative_id=$1", [
    owner.cooperativeId,
  ]);
  expect((await renew(request())).status).toBe(409);
  expect(await count('route_sheets')).toBe(1);
  await pool.query("UPDATE frequencies SET status='ACTIVE' WHERE cooperative_id=$1", [
    owner.cooperativeId,
  ]);
  const body = request();
  expect((await renew(body)).status).toBe(201);
  await pool.query("UPDATE frequencies SET status='INACTIVE' WHERE cooperative_id=$1", [
    owner.cooperativeId,
  ]);
  expect((await renew(body)).status).toBe(200);
});

test('un fallo después de las escrituras revierte borrador, tarifa, programación y procedencia', async () => {
  await publishedSource();
  const failingPool = {
    connect: async () => {
      const client = await pool.connect();
      return {
        release: () => client.release(),
        query: async (sql, values) => {
          if (String(sql).includes("'RENEWAL_PREPARE'"))
            throw new Error('fallo controlado de auditoría');
          return client.query(sql, values);
        },
      };
    },
  };
  const useCase = prepareRenewalFactory({
    renewalRepository: new PgRenewalRepository(failingPool, {
      frequencySessionFactory: frequencyQueries.forTransaction,
    }),
    busQueryPort: busQueries,
    now: () => '2029-12-31T00:00:00.000Z',
    newId: randomUUID,
  });
  await expect(
    useCase(
      { ...request(), sourceRouteSheetId: f.context.routeSheetId },
      { id: f.context.modifiedBy, cooperative_id: owner.cooperativeId, role: 'COOPERATIVE_ADMIN' },
    ),
  ).rejects.toThrow('fallo controlado');
  expect(await count('route_sheets')).toBe(1);
  expect(await count('route_sheet_programmings')).toBe(1);
  expect(await count('route_sheet_renewals')).toBe(0);
  expect(await count('route_sheet_trips')).toBe(3);
});
