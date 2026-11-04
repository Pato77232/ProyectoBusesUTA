const http = require('node:http');
const { randomUUID } = require('node:crypto');
const createApp = require('../../../src/app');
const { createAuthModule } = require('../../../src/modules/auth');
const { createTenantsModule } = require('../../../src/modules/tenants');
const { createFleetModule } = require('../../../src/modules/fleet');
const { createRouteSheetsModule } = require('../../../src/modules/route-sheets');
const { createHasher } = require('../../../src/modules/auth/infrastructure/password-hasher');
const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const SessionBrowser = require('../../helpers/session-browser');

const PASSWORD = 'contraseña ficticia auditoría';
const ROUTE_DATE = '2026-11-04';

let pool;
let server;
let url;
let cooperativeId;
let anotherCooperativeId;
let busGroupId;
let adminId;
let booking;

const bookingQueries = {
  hasPassengersForBusOnRouteSheet: async () => currentPassengers(),
  hasPassengersForAssignment: async () => currentPassengers(),
};

function currentPassengers() {
  if (booking.mode === 'unavailable') {
    const error = new Error('No está disponible el proveedor de consultas de reservas.');
    error.code = 'BOOKING_QUERIES_UNAVAILABLE';
    error.httpStatus = 503;
    throw error;
  }
  return booking.hasPassengers;
}

const busQueries = {
  findById: async (id, coopId) => ({ id, cooperativeId: coopId, busGroupId }),
  findByCooperativeId: async () => [],
  findByBusGroupId: async () => [],
};

const frequencyQueries = {
  findById: async (id) => ({ id, status: 'ACTIVE' }),
  findActiveByCooperativeId: async () => [{}, {}, {}, {}],
  findWithStops: async () => null,
};

function anyRuc() {
  return randomUUID().replace(/\D/g, '').slice(0, 13).padStart(13, '7');
}

async function createCooperative(name) {
  const { rows } = await pool.query(
    'INSERT INTO cooperatives(name, ruc) VALUES ($1, $2) RETURNING id',
    [name, anyRuc()],
  );
  return rows[0].id;
}

async function createUser(email, role, coopId = null) {
  const hash = await (await createHasher()).hash(PASSWORD);
  const { rows } = await pool.query(
    'INSERT INTO users(email, password_hash, role, cooperative_id) VALUES ($1, $2, $3, $4) RETURNING id',
    [email, hash, role, coopId],
  );
  return rows[0].id;
}

async function createBusGroup(coopId, name = 'Rutas largas') {
  const { rows } = await pool.query(
    "INSERT INTO bus_groups(cooperative_id, name, category) VALUES ($1, $2, 'LONG_ROUTE') RETURNING id",
    [coopId, name],
  );
  return rows[0].id;
}

async function createSheet(browser) {
  const res = await browser.request('/api/v1/route-sheets', 'POST', {
    busGroupId,
    routeDate: ROUTE_DATE,
  });
  if (res.status !== 201) throw new Error(`creación de hoja falló: ${res.status}`);
  return (await res.json()).routeSheet;
}

async function getLogs(browser, routeSheetId) {
  const res = await browser.request(`/api/v1/route-sheets/${routeSheetId}/modification-logs`);
  if (res.status !== 200) throw new Error(`consulta de logs falló: ${res.status}`);
  return (await res.json()).logs;
}

beforeAll(async () => {
  runMigration();
  pool = testPool();
  const auth = await createAuthModule({
    pool,
    env: { JWT_SECRET: 'test-only-route-secret-123456789012345' },
  });
  const tenants = createTenantsModule({ pool, auth });
  const fleet = createFleetModule({ pool, auth });
  const routeSheets = createRouteSheetsModule({
    pool,
    auth,
    frequencyQueries,
    busGroupQueries: fleet.busGroupQueries,
    busQueries,
    bookingQueries,
  });
  server = http.createServer(createApp({ auth, tenants, fleet, routeSheets, pool }));
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});

beforeEach(async () => {
  assertTestDatabase();
  booking = { mode: 'available', hasPassengers: false };
  await pool.query(
    'TRUNCATE route_sheet_renewals, route_sheet_trips, route_sheet_commercial_inventories, route_sheet_commercial_cycles, route_sheet_commercial_series, route_sheet_programming_blocks, route_sheet_transfers, route_sheet_service_points, route_sheet_bus_availability, route_sheet_required_services, route_sheet_programming_ids, route_sheet_programmings, bus_photos, bus_seats, buses, route_sheet_modification_logs, route_sheet_cycles, route_sheet_rest_days, route_sheet_assignments, route_sheets, bus_groups, auth_sessions, users, frequency_segment_prices, frequency_stops, frequencies, cooperatives',
  );
  cooperativeId = await createCooperative('Cooperativa de prueba');
  anotherCooperativeId = await createCooperative('Otra cooperativa');
  adminId = await createUser('coadmin@example.ec', 'COOPERATIVE_ADMIN', cooperativeId);
  await createUser('other@example.ec', 'COOPERATIVE_ADMIN', anotherCooperativeId);
  busGroupId = await createBusGroup(cooperativeId);
});

afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) await pool.end();
});

test('crear una asignación con motivo deja un log legible por la cooperativa', async () => {
  const browser = new SessionBrowser(url);
  await browser.login('coadmin@example.ec', PASSWORD);
  const sheet = await createSheet(browser);
  const busId = randomUUID();
  const frequencyId = randomUUID();

  const res = await browser.request(`/api/v1/route-sheets/${sheet.id}/assignments`, 'POST', {
    busId,
    frequencyId,
    reason: 'Cambio de bus por mantenimiento',
  });

  expect(res.status).toBe(200);
  const logs = await getLogs(browser, sheet.id);
  expect(logs).toHaveLength(1);
  expect(logs[0]).toMatchObject({
    routeSheetId: sheet.id,
    cooperativeId,
    busGroupId,
    modifiedBy: adminId,
    reason: 'Cambio de bus por mantenimiento',
    action: 'CREATE',
    affectedEntity: 'ASSIGNMENT',
    newValue: { busId, frequencyId },
    hasPassengersWarning: false,
  });
  expect(logs[0].entityId).toBeTruthy();
});

test('crear una asignación sin motivo no deja log y conserva la respuesta', async () => {
  const browser = new SessionBrowser(url);
  await browser.login('coadmin@example.ec', PASSWORD);
  const sheet = await createSheet(browser);

  const res = await browser.request(`/api/v1/route-sheets/${sheet.id}/assignments`, 'POST', {
    busId: randomUUID(),
    frequencyId: randomUUID(),
  });

  expect(res.status).toBe(200);
  expect(await getLogs(browser, sheet.id)).toHaveLength(0);
});

test('quitar una asignación con motivo registra el valor anterior y la advertencia de pasajeros', async () => {
  const browser = new SessionBrowser(url);
  await browser.login('coadmin@example.ec', PASSWORD);
  const sheet = await createSheet(browser);
  const busId = randomUUID();
  const frequencyId = randomUUID();
  const created = await browser.request(`/api/v1/route-sheets/${sheet.id}/assignments`, 'POST', {
    busId,
    frequencyId,
  });
  const assignmentId = (await created.json()).routeSheet.assignments[0].id;

  booking.hasPassengers = true;
  const res = await browser.request(
    `/api/v1/route-sheets/${sheet.id}/assignments/${assignmentId}`,
    'DELETE',
    { reason: 'Reasignación operativa', forceWithPassengersWarning: true },
  );

  expect(res.status).toBe(200);
  const logs = await getLogs(browser, sheet.id);
  expect(logs).toHaveLength(1);
  expect(logs[0]).toMatchObject({
    action: 'DELETE',
    affectedEntity: 'ASSIGNMENT',
    entityId: assignmentId,
    reason: 'Reasignación operativa',
    oldValue: { busId, frequencyId },
    hasPassengersWarning: true,
  });
});

test('agregar y quitar una parada de descanso con motivo deja dos logs', async () => {
  const browser = new SessionBrowser(url);
  await browser.login('coadmin@example.ec', PASSWORD);
  const sheet = await createSheet(browser);
  const busId = randomUUID();

  const added = await browser.request(`/api/v1/route-sheets/${sheet.id}/rest-days`, 'POST', {
    busId,
    reasonForChange: 'Descanso programado',
  });
  expect(added.status).toBe(200);
  const restDayId = (await added.json()).routeSheet.restDays[0].id;

  const removed = await browser.request(
    `/api/v1/route-sheets/${sheet.id}/rest-days/${restDayId}`,
    'DELETE',
    { reasonForChange: 'Cobertura de frecuencia' },
  );
  expect(removed.status).toBe(200);

  const logs = await getLogs(browser, sheet.id);
  expect(logs).toHaveLength(2);
  expect(logs.find((log) => log.action === 'CREATE')).toMatchObject({
    affectedEntity: 'REST_DAY',
    entityId: restDayId,
    reason: 'Descanso programado',
    newValue: { busId },
  });
  expect(logs.find((log) => log.action === 'DELETE')).toMatchObject({
    affectedEntity: 'REST_DAY',
    entityId: restDayId,
    reason: 'Cobertura de frecuencia',
    oldValue: { busId },
  });
});

test('si el proveedor de pasajeros falla no se aplica el cambio ni se escribe auditoría', async () => {
  const browser = new SessionBrowser(url);
  await browser.login('coadmin@example.ec', PASSWORD);
  const sheet = await createSheet(browser);
  const created = await browser.request(`/api/v1/route-sheets/${sheet.id}/assignments`, 'POST', {
    busId: randomUUID(),
    frequencyId: randomUUID(),
  });
  const assignmentId = (await created.json()).routeSheet.assignments[0].id;

  booking.mode = 'unavailable';
  const res = await browser.request(
    `/api/v1/route-sheets/${sheet.id}/assignments/${assignmentId}`,
    'DELETE',
    { reason: 'Reasignación operativa' },
  );

  expect(res.status).toBe(503);
  expect((await res.json()).error.code).toBe('BOOKING_QUERIES_UNAVAILABLE');
  expect(await getLogs(browser, sheet.id)).toHaveLength(0);
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS count FROM route_sheet_assignments WHERE route_sheet_id = $1',
    [sheet.id],
  );
  expect(rows[0].count).toBe(1);
});

test('una hoja publicada rechaza el cambio y no escribe auditoría', async () => {
  const browser = new SessionBrowser(url);
  await browser.login('coadmin@example.ec', PASSWORD);
  const sheet = await createSheet(browser);
  await pool.query("UPDATE route_sheets SET status = 'PUBLISHED' WHERE id = $1", [sheet.id]);

  const res = await browser.request(`/api/v1/route-sheets/${sheet.id}/assignments`, 'POST', {
    busId: randomUUID(),
    frequencyId: randomUUID(),
    reason: 'Intento sobre hoja publicada',
  });

  expect(res.status).toBe(403);
  expect((await res.json()).error.code).toBe('ROUTE_SHEET_NOT_EDITABLE');
  expect(await getLogs(browser, sheet.id)).toHaveLength(0);
});

test('quitar una parada de descanso acepta reason como alias de reasonForChange', async () => {
  const browser = new SessionBrowser(url);
  await browser.login('coadmin@example.ec', PASSWORD);
  const sheet = await createSheet(browser);
  const busId = randomUUID();

  const added = await browser.request(`/api/v1/route-sheets/${sheet.id}/rest-days`, 'POST', {
    busId,
    reason: 'Descanso programado',
  });
  expect(added.status).toBe(200);
  const restDayId = (await added.json()).routeSheet.restDays[0].id;

  const removed = await browser.request(
    `/api/v1/route-sheets/${sheet.id}/rest-days/${restDayId}`,
    'DELETE',
    { reason: 'Cobertura de frecuencia' },
  );
  expect(removed.status).toBe(200);

  const logs = await getLogs(browser, sheet.id);
  expect(logs).toHaveLength(2);
  expect(logs.find((log) => log.action === 'CREATE')).toMatchObject({
    reason: 'Descanso programado',
  });
  expect(logs.find((log) => log.action === 'DELETE')).toMatchObject({
    reason: 'Cobertura de frecuencia',
    affectedEntity: 'REST_DAY',
  });
});

test('una hoja con programación persistida conserva el 409 y no escribe auditoría', async () => {
  const browser = new SessionBrowser(url);
  await browser.login('coadmin@example.ec', PASSWORD);
  const sheet = await createSheet(browser);
  await pool.query(
    `INSERT INTO route_sheet_programmings(route_sheet_id, cooperative_id, revision, schema_version, cycle_start_date, cycle_length_days, start_at, end_exclusive, updated_by)
     VALUES ($1, $2, 1, 1, '2026-11-04', 14, '2026-11-04T05:00:00Z', '2026-11-18T05:00:00Z', $3)`,
    [sheet.id, cooperativeId, adminId],
  );

  const res = await browser.request(`/api/v1/route-sheets/${sheet.id}/assignments`, 'POST', {
    busId: randomUUID(),
    frequencyId: randomUUID(),
    reason: 'Cambio legacy sobre hoja programada',
  });

  expect(res.status).toBe(409);
  expect((await res.json()).error.code).toBe('ROUTE_PROGRAMMING_LEGACY_OPERATION');
  expect(await getLogs(browser, sheet.id)).toHaveLength(0);
});

test('el cuerpo no puede falsear la cooperativa ni el actor de la auditoría', async () => {
  const browser = new SessionBrowser(url);
  await browser.login('coadmin@example.ec', PASSWORD);
  const sheet = await createSheet(browser);
  const forgedActor = randomUUID();

  const res = await browser.request(`/api/v1/route-sheets/${sheet.id}/assignments`, 'POST', {
    busId: randomUUID(),
    frequencyId: randomUUID(),
    reason: 'Cambio con datos falseados en el cuerpo',
    cooperativeId: anotherCooperativeId,
    modifiedBy: forgedActor,
  });

  expect(res.status).toBe(200);
  const logs = await getLogs(browser, sheet.id);
  expect(logs).toHaveLength(1);
  expect(logs[0].cooperativeId).toBe(cooperativeId);
  expect(logs[0].modifiedBy).toBe(adminId);
});

test('otra cooperativa no puede leer ni escribir la auditoría de la hoja', async () => {
  const browser = new SessionBrowser(url);
  await browser.login('coadmin@example.ec', PASSWORD);
  const sheet = await createSheet(browser);
  await browser.request(`/api/v1/route-sheets/${sheet.id}/assignments`, 'POST', {
    busId: randomUUID(),
    frequencyId: randomUUID(),
    reason: 'Cambio de bus por mantenimiento',
  });

  const other = new SessionBrowser(url);
  await other.login('other@example.ec', PASSWORD);
  const readRes = await other.request(`/api/v1/route-sheets/${sheet.id}/modification-logs`);
  expect(readRes.status).toBe(404);
  expect((await readRes.json()).error.code).toBe('ROUTE_SHEET_NOT_FOUND');

  const writeRes = await other.request(`/api/v1/route-sheets/${sheet.id}/assignments`, 'POST', {
    busId: randomUUID(),
    frequencyId: randomUUID(),
    reason: 'Intento de otra cooperativa',
  });
  expect(writeRes.status).toBe(404);

  const logs = await getLogs(browser, sheet.id);
  expect(logs).toHaveLength(1);
  expect(logs[0].cooperativeId).toBe(cooperativeId);
});
