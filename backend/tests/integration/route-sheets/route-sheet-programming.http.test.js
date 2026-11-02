const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { start } = require('../../../src/server');
const { createHasher } = require('../../../src/modules/auth/infrastructure/password-hasher');
const { createFleetModule } = require('../../../src/modules/fleet');
const { createFrequenciesModule } = require('../../../src/modules/frequencies');
const PgBusRepository = require('../../../src/modules/fleet/infrastructure/pg-bus.repository');
const PgProgrammingRepository = require('../../../src/modules/route-sheets/infrastructure/repositories/pg-route-sheet-programming-repository');
const PgTariffRepository = require('../../../src/modules/route-sheets/infrastructure/repositories/pg-route-sheet-tariff-repository');
const publishFactory = require('../../../src/modules/route-sheets/application/use-cases/publish-route-sheet.use-case');
const { runMigration } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { fleetFixtures, busRequest } = require('../../helpers/fleet-bus');
const makeFixture = require('../../helpers/route-programming');
const Browser = require('../../helpers/session-browser');

const PASSWORD = 'solo pruebas programacion HTTP 2026';
let pool, server, url, hash, admin, other, f, signals, busQueries, frequencyQueries;
const pass = (_req, _res, next) => next();
const auth = { authenticate: pass, authorize: () => pass, csrfProtection: pass };
const path = (suffix = 'programming') => `/api/v1/route-sheets/${f.context.routeSheetId}/${suffix}`;
const program = () => admin.request(path(), 'PUT', f.body);

async function freePort() {
  const temp = http.createServer();
  await new Promise((resolve) => temp.listen(0, '127.0.0.1', resolve));
  const port = temp.address().port;
  await new Promise((resolve) => temp.close(resolve));
  return port;
}
async function user(email, role, cooperativeId) {
  return (
    await pool.query(
      'INSERT INTO users(email,password_hash,role,cooperative_id) VALUES($1,$2,$3,$4) RETURNING id',
      [email, hash, role, cooperativeId],
    )
  ).rows[0].id;
}
function tariff(frequencies = f.frequencies) {
  return {
    expectedRevision: 0,
    policy: {
      vipSurchargeBps: 2500,
      minorDiscountBps: 5000,
      seniorDiscountBps: 5000,
      disabilityDiscountBps: 5000,
    },
    frequencies: frequencies.map((v) => ({
      frequencyId: v.id,
      prices: [{ fromPosition: 0, toPosition: 1, amountCents: 450 }],
    })),
  };
}
async function ready() {
  expect((await program()).status).toBe(200);
  expect((await admin.request(path('tariff'), 'PUT', tariff())).status).toBe(200);
}
const publish = (expectedProgrammingRevision = 1) =>
  admin.request(path('publish'), 'POST', { expectedRevision: 1, expectedProgrammingRevision });
const row = async () =>
  (await pool.query('SELECT * FROM route_sheets WHERE id=$1', [f.context.routeSheetId])).rows[0];

beforeAll(async () => {
  runMigration();
  hash = await (await createHasher()).hash(PASSWORD);
  signals = new Map(['SIGTERM', 'SIGINT'].map((s) => [s, process.listeners(s)]));
  const running = await start({
    DATABASE_URL: assertTestDatabase(),
    JWT_SECRET: 'programming-http-only-test-secret-1234567890123456',
    NODE_ENV: 'test',
    PORT: String(await freePort()),
  });
  pool = running.pool;
  server = running.server;
  url = `http://127.0.0.1:${server.address().port}`;
  busQueries = createFleetModule({ pool, auth, env: { NODE_ENV: 'test' } }).busQueries;
  frequencyQueries = createFrequenciesModule({ pool, auth }).frequencyQueries;
});
beforeEach(async () => {
  assertTestDatabase();
  await pool.query('TRUNCATE cooperatives,users,auth_sessions CASCADE');
  const owners = await fleetFixtures(pool);
  const bus = await new PgBusRepository(pool).create(busRequest(owners.first));
  f = makeFixture({ ...owners.first, busId: bus.id });
  f.context.modifiedBy = await user(
    'program-admin@example.ec',
    'COOPERATIVE_ADMIN',
    f.cooperativeId,
  );
  await user('program-other@example.ec', 'COOPERATIVE_ADMIN', owners.second.cooperativeId);
  f.context.routeSheetId = (
    await pool.query(
      "INSERT INTO route_sheets(cooperative_id,bus_group_id,route_date) VALUES($1,$2,'2026-11-02') RETURNING id",
      [f.cooperativeId, f.busGroupId],
    )
  ).rows[0].id;
  for (const v of f.frequencies)
    await pool.query(
      'INSERT INTO frequencies(id,cooperative_id,origin,destination,departure_time,ant_resolution_number) VALUES($1,$2,$3,$4,$5,$6)',
      [v.id, f.cooperativeId, v.origin, v.destination, v.departureTime, v.antResolutionNumber],
    );
  admin = new Browser(url);
  other = new Browser(url);
  await admin.login('program-admin@example.ec', PASSWORD);
  await other.login('program-other@example.ec', PASSWORD);
});
afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) await pool.end();
  for (const [signal, previous] of signals ?? [])
    for (const listener of process.listeners(signal))
      if (!previous.includes(listener)) process.removeListener(signal, listener);
});

test('GET distingue hoja propia sin programación de hoja inexistente', async () => {
  const response = await admin.request(path());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    routeSheetId: f.context.routeSheetId,
    cooperativeId: f.cooperativeId,
    revision: 0,
    programming: null,
  });
  expect((await admin.request(`/api/v1/route-sheets/${randomUUID()}/programming`)).status).toBe(
    404,
  );
});

test('PUT y GET recuperan identidades, fechas y revisión para editar sin perder datos', async () => {
  const saved = await (await program()).json();
  expect(saved.revision).toBe(1);
  const response = await admin.request(path());
  expect(await response.json()).toEqual(saved);
  const next = await admin.request(path(), 'PUT', { ...f.body, expectedRevision: 1 });
  expect(next.status).toBe(200);
  expect((await next.json()).revision).toBe(2);
  const stale = await program();
  expect(stale.status).toBe(409);
  expect((await stale.json()).error.code).toBe('ROUTE_PROGRAMMING_REVISION_CONFLICT');
});

test('exige autenticación y CSRF sin persistir solicitudes rechazadas', async () => {
  const anonymous = new Browser(url);
  expect((await anonymous.request(path())).status).toBe(401);
  expect((await anonymous.request(path(), 'PUT', f.body)).status).toBe(401);
  expect((await admin.request(path(), 'PUT', f.body, 'incorrecto')).status).toBe(403);
  expect((await (await admin.request(path())).json()).revision).toBe(0);
});

test.each(['CLERK', 'CUSTOMER', 'SYSTEM_ADMIN'])(
  'no habilita programación al rol %s',
  async (role) => {
    const email = `${role.toLowerCase()}@example.ec`;
    await user(email, role, role === 'CLERK' ? f.cooperativeId : null);
    const browser = new Browser(url);
    await browser.login(email, PASSWORD);
    expect((await browser.request(path())).status).toBe(403);
    expect((await browser.request(path(), 'PUT', f.body)).status).toBe(403);
  },
);

test('tenant de otra sesión no puede consultar ni editar aunque conozca el ID', async () => {
  expect((await other.request(path())).status).toBe(404);
  expect((await other.request(path(), 'PUT', f.body)).status).toBe(404);
  expect((await other.request(`${path()}?cooperativeId=${f.cooperativeId}`)).status).toBe(404);
});

test.each(['cooperativeId', 'modifiedBy', 'status'])(
  'rechaza autoridad enviada en body: %s',
  async (key) => {
    const response = await admin.request(path(), 'PUT', { ...f.body, [key]: randomUUID() });
    expect(response.status).toBe(400);
    expect((await (await admin.request(path())).json()).revision).toBe(0);
  },
);

test('identificador malformado y puntos incompletos no escriben', async () => {
  expect((await admin.request('/api/v1/route-sheets/no-uuid/programming')).status).toBe(400);
  f.body.programming.agendas[0].activities[0].points.pop();
  expect((await program()).status).toBe(400);
  expect((await (await admin.request(path())).json()).revision).toBe(0);
});

test('publicación nueva de hoja legada exige programación completa', async () => {
  await pool.query(
    'INSERT INTO route_sheet_assignments(route_sheet_id,cooperative_id,bus_group_id,bus_id,frequency_id) VALUES($1,$2,$3,$4,$5)',
    [f.context.routeSheetId, f.cooperativeId, f.busGroupId, f.busId, f.frequencies[0].id],
  );
  expect((await admin.request(path('tariff'), 'PUT', tariff([f.frequencies[0]]))).status).toBe(200);
  const response = await admin.request(path('publish'), 'POST', {});
  expect(response.status).toBe(409);
  expect((await response.json()).error.code).toBe('ROUTE_PROGRAMMING_REQUIRED');
  expect((await row()).tariff_frozen).toBeNull();
});

test('publica programación validada y congela tarifa en la misma operación', async () => {
  await ready();
  expect((await publish()).status).toBe(200);
  expect((await row()).tariff_frozen_revision).toBe(1);
  expect((await row()).status).toBe('PUBLISHED');
  expect((await (await admin.request(path())).json()).revision).toBe(1);
  expect((await admin.request(path(), 'PUT', { ...f.body, expectedRevision: 1 })).status).toBe(409);
});

test('revisión de programación desactualizada bloquea publicar sin congelación parcial', async () => {
  await ready();
  expect((await admin.request(path(), 'PUT', { ...f.body, expectedRevision: 1 })).status).toBe(200);
  const stale = await publish();
  expect(stale.status).toBe(409);
  expect((await stale.json()).error.code).toBe('ROUTE_PROGRAMMING_REVISION_CONFLICT');
  expect((await row()).tariff_frozen).toBeNull();
  expect((await publish(2)).status).toBe(200);
});

test.each([0, null, '1', 1.5])(
  'publicación rechaza revisión de programación inválida %s',
  async (revision) => {
    await ready();
    expect((await publish(revision)).status).toBe(400);
    expect((await row()).status).toBe('DRAFT');
  },
);

test('edición y publicación concurrentes no aceptan una revisión diferente de la mostrada', async () => {
  await ready();
  const results = await Promise.all([
    publish(),
    admin.request(path(), 'PUT', { ...f.body, expectedRevision: 1 }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  const state = await row();
  const record = await (await admin.request(path())).json();
  if (state.status === 'PUBLISHED') expect(record.revision).toBe(1);
  else {
    expect(record.revision).toBe(2);
    expect(state.tariff_frozen).toBeNull();
  }
});

test.each([
  ['POST', 'assignments'],
  ['DELETE', 'assignments/00000000-0000-4000-8000-000000000001'],
  ['POST', 'rest-days'],
  ['DELETE', 'rest-days/00000000-0000-4000-8000-000000000001'],
  ['POST', 'generate-cycles'],
])('ruta antigua %s %s no elude validación integral', async (method, suffix) => {
  await program();
  const response = await admin.request(path(suffix), method, {
    busId: f.busId,
    frequencyId: f.frequencies[0].id,
  });
  expect(response.status).toBe(409);
  expect((await response.json()).error.code).toBe('ROUTE_PROGRAMMING_LEGACY_OPERATION');
});

test('otra hoja legada tampoco puede asignar un bus ya programado', async () => {
  await program();
  const sheet = (
    await pool.query(
      "INSERT INTO route_sheets(cooperative_id,bus_group_id,route_date) VALUES($1,$2,'2026-11-03') RETURNING id",
      [f.cooperativeId, f.busGroupId],
    )
  ).rows[0].id;
  const response = await admin.request(`/api/v1/route-sheets/${sheet}/assignments`, 'POST', {
    busId: f.busId,
    frequencyId: f.frequencies[0].id,
  });
  expect(response.status).toBe(409);
  expect((await response.json()).error.code).toBe('ROUTE_PROGRAMMING_LEGACY_OPERATION');
});

test('reintento publicado conserva actor y fecha sin volver a consultar fuentes mutables', async () => {
  await ready();
  expect((await publish()).status).toBe(200);
  const before = await row();
  await pool.query("UPDATE frequencies SET status='INACTIVE' WHERE id=$1", [f.frequencies[0].id]);
  expect((await publish()).status).toBe(200);
  const after = await row();
  expect(after.tariff_frozen_at).toEqual(before.tariff_frozen_at);
  expect(after.published_by).toBe(before.published_by);
  expect((await publish(2)).status).toBe(409);
});

test('no reinterpreta lugares de una programación alterada', async () => {
  await ready();
  await pool.query(
    "UPDATE route_sheet_service_points SET location_key='Otra ciudad' WHERE assignment_id=$1 AND position=0",
    [f.body.programming.agendas[0].activities[0].id],
  );
  const response = await publish();
  expect(response.status).toBe(409);
  expect((await response.json()).error.code).toBe('ROUTE_PROGRAMMING_ROUTE_CONFLICT');
  expect((await row()).tariff_frozen).toBeNull();
});

test('reintento de hoja histórica publicada conserva snapshot aunque no tenga programación', async () => {
  await pool.query(
    'INSERT INTO route_sheet_assignments(route_sheet_id,cooperative_id,bus_group_id,bus_id,frequency_id) VALUES($1,$2,$3,$4,$5)',
    [f.context.routeSheetId, f.cooperativeId, f.busGroupId, f.busId, f.frequencies[0].id],
  );
  await admin.request(path('tariff'), 'PUT', tariff([f.frequencies[0]]));
  await pool.query(
    "UPDATE route_sheets SET status='PUBLISHED',published_by=$2,published_at=CURRENT_TIMESTAMP,tariff_frozen=tariff_draft,tariff_frozen_revision=tariff_revision,tariff_frozen_at=CURRENT_TIMESTAMP,tariff_frozen_by=$2 WHERE id=$1",
    [f.context.routeSheetId, f.context.modifiedBy],
  );
  const before = await row();
  expect((await admin.request(path('publish'), 'POST', {})).status).toBe(200);
  expect((await (await admin.request(path())).json()).programming).toBeNull();
  expect((await row()).published_at).toEqual(before.published_at);
});

test('fallo después de congelar revierte también publicación y conserva programación', async () => {
  await ready();
  const error = new Error('Fallo ficticio posterior al freeze');
  const failingPool = {
    connect: async () => {
      const client = await pool.connect();
      return {
        release: () => client.release(),
        query: async (sql, params) => {
          const result = await client.query(sql, params);
          if (sql.includes("status = 'PUBLISHED', published_by")) throw error;
          return result;
        },
      };
    },
  };
  await expect(
    publishFactory({
      tariffRepository: new PgTariffRepository(failingPool, {
        frequencySessionFactory: frequencyQueries.forTransaction,
      }),
      busQueryPort: busQueries,
    })({
      routeSheetId: f.context.routeSheetId,
      cooperativeId: f.cooperativeId,
      publishedBy: f.context.modifiedBy,
      expectedProgrammingRevision: 1,
    }),
  ).rejects.toBe(error);
  expect((await row()).status).toBe('DRAFT');
  expect((await row()).tariff_frozen).toBeNull();
  expect((await (await admin.request(path())).json()).revision).toBe(1);
});

test('lectura conserva una única revisión aunque se confirme una edición entre consultas', async () => {
  await program();
  let release, signal;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const entered = new Promise((resolve) => {
    signal = resolve;
  });
  const readingPool = {
    connect: async () => {
      const client = await pool.connect();
      return {
        release: () => client.release(),
        query: async (sql, params) => {
          const result = await client.query(sql, params);
          if (sql.includes('FROM route_sheet_programmings p JOIN')) {
            signal();
            await gate;
          }
          return result;
        },
      };
    },
  };
  const pending = new PgProgrammingRepository(readingPool).findSnapshot(f.context);
  const changed = JSON.parse(JSON.stringify(f.body));
  changed.programming.agendas[0].activities[2].preparationMinutes = 30;
  try {
    await entered;
    expect((await admin.request(path(), 'PUT', { ...changed, expectedRevision: 1 })).status).toBe(
      200,
    );
  } finally {
    release();
  }
  const original = await pending;
  expect(original.revision).toBe(1);
  expect(original.programming.agendas[0].activities[2].preparationMinutes).toBe(15);
  const latest = await (await admin.request(path())).json();
  expect(latest.revision).toBe(2);
  expect(latest.programming.agendas[0].activities[2].preparationMinutes).toBe(30);
});

test('PUT y GET conservan fechas nocturnas, embarques intermedios y mantenimiento', async () => {
  const frequencyId = randomUUID();
  await pool.query(
    "INSERT INTO frequencies(id,cooperative_id,origin,destination,departure_time,ant_resolution_number) VALUES($1,$2,'Ambato','Quito','23:00','ANT-NOCTURNA')",
    [frequencyId, f.cooperativeId],
  );
  await pool.query(
    "INSERT INTO frequency_stops(frequency_id,position,place) VALUES($1,1,'Latacunga')",
    [frequencyId],
  );
  const a = f.body.programming.agendas[0].activities[0];
  a.frequencyId = frequencyId;
  a.departureAt = '2026-11-02T23:00:00-05:00';
  a.arrivalAt = '2026-11-03T02:00:00-05:00';
  a.points = [
    { position: 0, departureAt: a.departureAt },
    {
      position: 1,
      arrivalAt: '2026-11-03T00:15:00-05:00',
      departureAt: '2026-11-03T00:20:00-05:00',
    },
    { position: 2, arrivalAt: a.arrivalAt },
  ];
  f.body.programming.cycleLengthDays = 2;
  f.body.programming.requiredServices = [
    { id: a.requiredServiceId, frequencyId, departureAt: a.departureAt },
  ];
  f.body.programming.agendas[0].activities = [
    a,
    {
      id: randomUUID(),
      kind: 'TRANSFER',
      originKey: 'Quito',
      destinationKey: 'Ambato',
      departureAt: '2026-11-03T02:15:00-05:00',
      arrivalAt: '2026-11-03T05:00:00-05:00',
      preparationMinutes: 0,
    },
  ];
  f.body.programming.agendas[0].blocks = [
    {
      id: randomUUID(),
      kind: 'MAINTENANCE',
      startAt: '2026-11-03T06:00:00-05:00',
      endAt: '2026-11-03T07:00:00-05:00',
      reason: 'Revisión programada',
    },
  ];
  expect((await program()).status).toBe(200);
  const saved = await (await admin.request(path())).json();
  expect(saved.programming.agendas[0].activities[0].points[1]).toMatchObject({
    locationKey: 'Latacunga',
    departureAt: '2026-11-03T05:20:00.000Z',
  });
  expect(saved.programming.agendas[0].blocks[0].reason).toBe('Revisión programada');
});

test('cambio de frecuencia exige reconfigurar matriz sin alterar la tarifa anterior', async () => {
  await ready();
  const oldTariff = (await row()).tariff_draft;
  const id = randomUUID();
  await pool.query(
    "INSERT INTO frequencies(id,cooperative_id,origin,destination,departure_time,ant_resolution_number) VALUES($1,$2,'Ambato','Latacunga','06:00','ANT-OTRA')",
    [id, f.cooperativeId],
  );
  f.frequencies[0].id = id;
  const a = f.body.programming.agendas[0].activities[0];
  a.id = randomUUID();
  a.requiredServiceId = randomUUID();
  a.frequencyId = id;
  a.departureAt = '2026-11-02T06:00:00-05:00';
  a.points[0].departureAt = a.departureAt;
  f.body.programming.requiredServices[0] = {
    id: a.requiredServiceId,
    frequencyId: id,
    departureAt: a.departureAt,
  };
  expect((await admin.request(path(), 'PUT', { ...f.body, expectedRevision: 1 })).status).toBe(200);
  expect((await row()).tariff_draft).toEqual(oldTariff);
  const rejected = await publish(2);
  expect(rejected.status).toBe(409);
  expect((await rejected.json()).error.code).toBe('ROUTE_TARIFF_FREQUENCY_MISMATCH');
  expect(
    (await admin.request(path('tariff'), 'PUT', { ...tariff(), expectedRevision: 1 })).status,
  ).toBe(200);
  expect(
    (
      await admin.request(path('publish'), 'POST', {
        expectedRevision: 2,
        expectedProgrammingRevision: 2,
      })
    ).status,
  ).toBe(200);
});
