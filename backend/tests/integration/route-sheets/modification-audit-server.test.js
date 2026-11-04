const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { start } = require('../../../src/server');
const { createHasher } = require('../../../src/modules/auth/infrastructure/password-hasher');
const PgBusRepository = require('../../../src/modules/fleet/infrastructure/pg-bus.repository');
const { fleetFixtures, busRequest } = require('../../helpers/fleet-bus');
const { runMigration } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const SessionBrowser = require('../../helpers/session-browser');

const PASSWORD = 'auditoria-servidor-solo-pruebas';
const ROUTE_DATE = '2030-01-01';
const kinds = ['assignment', 'rest'];
let running,
  pool,
  url,
  hash,
  owner,
  otherOwner,
  actor,
  admin,
  outsider,
  sheet,
  bus,
  restBus,
  frequencyId;

async function freePort() {
  const listener = http.createServer();
  await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return port;
}
const endpoint = (suffix) => `/api/v1/route-sheets/${sheet.id}/${suffix}`;
async function create(kind, reason, extra = {}) {
  const body = kind === 'assignment' ? { busId: bus.id, frequencyId } : { busId: restBus.id };
  return admin.request(endpoint(kind === 'assignment' ? 'assignments' : 'rest-days'), 'POST', {
    ...body,
    reason,
    ...extra,
  });
}
async function logs(browser = admin) {
  const response = await browser.request(endpoint('modification-logs'));
  expect(response.status).toBe(200);
  return (await response.json()).logs;
}
async function snapshot() {
  const result = {};
  for (const table of [
    'route_sheet_assignments',
    'route_sheet_rest_days',
    'route_sheet_modification_logs',
  ]) {
    result[table] = (
      await pool.query(
        `SELECT * FROM ${table} WHERE route_sheet_id=$1 AND cooperative_id=$2 ORDER BY id`,
        [sheet.id, owner.cooperativeId],
      )
    ).rows;
  }
  return result;
}

beforeAll(async () => {
  runMigration();
  hash = await (await createHasher()).hash(PASSWORD);
  running = await start({
    NODE_ENV: 'test',
    DATABASE_URL: assertTestDatabase(),
    JWT_SECRET: 'audit-server-test-only-secret-12345678901234567890',
    PORT: String(await freePort()),
  });
  pool = running.pool;
  url = `http://127.0.0.1:${running.server.address().port}`;
});
beforeEach(async () => {
  assertTestDatabase();
  await pool.query('TRUNCATE cooperatives,users,auth_sessions CASCADE');
  ({ first: owner, second: otherOwner } = await fleetFixtures(pool));
  bus = await new PgBusRepository(pool).create(busRequest(owner));
  restBus = await new PgBusRepository(pool).create(
    busRequest({ ...owner, data: { plate: 'TBM0027', vin: 'VIN0027', unitNumber: 2 } }),
  );
  frequencyId = randomUUID();
  await pool.query(
    "INSERT INTO frequencies(id,cooperative_id,origin,destination,departure_time,ant_resolution_number) VALUES($1,$2,'Ambato','Quito','07:00','ANT-QA-AUDITORIA')",
    [frequencyId, owner.cooperativeId],
  );
  for (const [email, cooperativeId] of [
    ['audit-owner@example.ec', owner.cooperativeId],
    ['audit-other@example.ec', otherOwner.cooperativeId],
  ]) {
    const { rows } = await pool.query(
      "INSERT INTO users(email,password_hash,role,cooperative_id) VALUES($1,$2,'COOPERATIVE_ADMIN',$3) RETURNING id",
      [email, hash, cooperativeId],
    );
    if (cooperativeId === owner.cooperativeId) actor = rows[0].id;
  }
  admin = new SessionBrowser(url);
  outsider = new SessionBrowser(url);
  await admin.login('audit-owner@example.ec', PASSWORD);
  await outsider.login('audit-other@example.ec', PASSWORD);
  const response = await admin.request('/api/v1/route-sheets', 'POST', {
    busGroupId: owner.busGroupId,
    routeDate: ROUTE_DATE,
  });
  expect(response.status).toBe(201);
  sheet = (await response.json()).routeSheet;
});
afterAll(async () => {
  await running?.stop();
});

test('el servidor productivo arranca y responde salud con PostgreSQL aislado', async () => {
  expect((await fetch(`${url}/api/v1/health`)).status).toBe(200);
  expect(await logs()).toEqual([]);
});

test.each(kinds)(
  'el alta real de %s registra un único log con contexto verificado',
  async (kind) => {
    expect(
      (
        await create(kind, '  Ajuste operativo  ', {
          cooperativeId: otherOwner.cooperativeId,
          modifiedBy: randomUUID(),
        })
      ).status,
    ).toBe(200);
    const result = await logs();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      routeSheetId: sheet.id,
      cooperativeId: owner.cooperativeId,
      busGroupId: owner.busGroupId,
      modifiedBy: actor,
      reason: 'Ajuste operativo',
      action: 'CREATE',
      affectedEntity: kind === 'assignment' ? 'ASSIGNMENT' : 'REST_DAY',
      hasPassengersWarning: false,
      newValue: kind === 'assignment' ? { busId: bus.id, frequencyId } : { busId: restBus.id },
    });
    expect(await logs()).toEqual(result);
  },
);

test.each(kinds)(
  'el alta real de %s sin motivo conserva el cambio sin inventar auditoría',
  async (kind) => {
    expect((await create(kind, '   ')).status).toBe(200);
    expect(await logs()).toEqual([]);
    const rows = await snapshot();
    expect(
      rows[kind === 'assignment' ? 'route_sheet_assignments' : 'route_sheet_rest_days'],
    ).toHaveLength(1);
  },
);

test.each(kinds)(
  'la baja real de %s consulta Reservas, elimina una vez y no duplica la auditoría',
  async (kind) => {
    const response = await create(kind, 'Alta para comprobar protección');
    expect(response.status).toBe(200);
    const result = (await response.json()).routeSheet;
    const entity = kind === 'assignment' ? result.assignments[0] : result.restDays[0];
    const path = endpoint(`${kind === 'assignment' ? 'assignments' : 'rest-days'}/${entity.id}`);
    const previousLogs = await logs();
    const body = {
      reason: 'Baja de prueba',
      reasonForChange: 'Baja de prueba',
      forceWithPassengersWarning: true,
    };
    // El servidor ya conecta las ocupaciones reales: sin pasajeros, la baja procede.
    expect((await admin.request(path, 'DELETE', body)).status).toBe(200);
    const afterRemoval = await snapshot();
    expect(
      afterRemoval[kind === 'assignment' ? 'route_sheet_assignments' : 'route_sheet_rest_days'],
    ).toHaveLength(0);
    const removalLogs = await logs();
    expect(removalLogs).toHaveLength(previousLogs.length + 1);
    expect(removalLogs).toEqual(expect.arrayContaining(previousLogs));
    expect(removalLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'DELETE',
          cooperativeId: owner.cooperativeId,
          modifiedBy: actor,
          reason: 'Baja de prueba',
          hasPassengersWarning: false,
        }),
      ]),
    );
    // Repetir la baja es idempotente: no cambia datos ni agrega otro log.
    expect((await admin.request(path, 'DELETE', body)).status).toBe(200);
    expect(await snapshot()).toEqual(afterRemoval);
    expect(await logs()).toEqual(removalLogs);
  },
);

test('el servidor real protege logs ajenos y rechaza escrituras sin CSRF', async () => {
  expect((await create('assignment', 'Auditoría propia')).status).toBe(200);
  const before = await snapshot();
  expect((await outsider.request(endpoint('modification-logs'))).status).toBe(404);
  expect((await new SessionBrowser(url).request(endpoint('modification-logs'))).status).toBe(401);
  const denied = await admin.request(
    endpoint('rest-days'),
    'POST',
    { busId: restBus.id, reason: 'Sin CSRF' },
    '',
  );
  expect(denied.status).toBe(403);
  expect(await snapshot()).toEqual(before);
});
