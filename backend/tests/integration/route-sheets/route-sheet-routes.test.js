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

const PASSWORD = 'contraseña ficticia route-sheets';

let pool;
let server;
let url;
let cooperativeId;
let anotherCooperativeId;

class Browser {
  constructor() {
    this.cookies = new Map();
    this.csrf = '';
  }

  async request(path, method = 'GET', body, csrf = this.csrf) {
    const headers = { cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') };
    if (method !== 'GET') {
      headers['Content-Type'] = 'application/json';
      headers['X-CSRF-Token'] = csrf;
    }
    const res = await fetch(url + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const cookie of res.headers.getSetCookie()) {
      const first = cookie.split(';')[0];
      const i = first.indexOf('=');
      this.cookies.set(first.slice(0, i), first.slice(i + 1));
    }
    return res;
  }

  async token() {
    const res = await this.request('/api/v1/auth/csrf');
    this.csrf = (await res.json()).csrfToken;
  }

  async signIn(email) {
    await this.token();
    const res = await this.request('/api/v1/auth/login', 'POST', { email, password: PASSWORD });
    if (res.status !== 200) throw new Error(`login failed: ${res.status}`);
    await this.token();
  }
}

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
  await pool.query(
    'INSERT INTO users(email, password_hash, role, cooperative_id) VALUES ($1, $2, $3, $4)',
    [email, hash, role, coopId],
  );
}

async function createBusGroup(coopId, name = 'Rutas largas') {
  const { rows } = await pool.query(
    "INSERT INTO bus_groups(cooperative_id, name, category) VALUES ($1, $2, 'LONG_ROUTE') RETURNING id",
    [coopId, name],
  );
  return rows[0].id;
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
    busGroupQueries: fleet.busGroupQueries,
  });
  server = http.createServer(createApp({ auth, tenants, fleet, routeSheets, pool }));
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});

beforeEach(async () => {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE route_sheet_modification_logs, route_sheet_cycles, route_sheet_rest_days, route_sheet_assignments, route_sheets, bus_groups, auth_sessions, users, frequency_segment_prices, frequency_stops, frequencies, cooperatives',
  );
  cooperativeId = await createCooperative('Cooperativa de prueba');
  anotherCooperativeId = await createCooperative('Otra cooperativa');
  await createUser('coadmin@example.ec', 'COOPERATIVE_ADMIN', cooperativeId);
  await createUser('other@example.ec', 'COOPERATIVE_ADMIN', anotherCooperativeId);
});

afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) await pool.end();
});

test('un COOPERATIVE_ADMIN puede crear una hoja de ruta por grupo', async () => {
  const busGroupId = await createBusGroup(cooperativeId);
  const browser = new Browser();
  await browser.signIn('coadmin@example.ec');
  const res = await browser.request('/api/v1/route-sheets', 'POST', {
    busGroupId,
    routeDate: '2026-10-25',
  });
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.routeSheet).toMatchObject({
    cooperativeId,
    busGroupId,
    routeDate: '2026-10-25',
    status: 'DRAFT',
  });
});

test('no permite crear dos hojas para misma fecha y grupo', async () => {
  const busGroupId = await createBusGroup(cooperativeId);
  const browser = new Browser();
  await browser.signIn('coadmin@example.ec');
  await browser.request('/api/v1/route-sheets', 'POST', { busGroupId, routeDate: '2026-10-25' });
  const res = await browser.request('/api/v1/route-sheets', 'POST', {
    busGroupId,
    routeDate: '2026-10-25',
  });
  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.error.code).toBe('ROUTE_SHEET_ALREADY_EXISTS_FOR_DATE_AND_GROUP');
});

test('aislamiento multi-tenant: no puede acceder a hoja de otra cooperativa', async () => {
  const busGroupId = await createBusGroup(cooperativeId);
  const browser = new Browser();
  await browser.signIn('coadmin@example.ec');
  const createRes = await browser.request('/api/v1/route-sheets', 'POST', {
    busGroupId,
    routeDate: '2026-10-25',
  });
  const { routeSheet } = await createRes.json();

  const browser2 = new Browser();
  await browser2.signIn('other@example.ec');
  const listRes = await browser2.request('/api/v1/route-sheets');
  expect(listRes.status).toBe(200);
  const listBody = await listRes.json();
  expect(listBody.routeSheets.find((r) => r.id === routeSheet.id)).toBeUndefined();
});

test('obtener ventana de compra retorna maxCycles 2', async () => {
  const browser = new Browser();
  await browser.signIn('coadmin@example.ec');
  const res = await browser.request('/api/v1/route-sheets/purchase-window');
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.purchaseWindow.maxCycles).toBe(2);
  expect(body.purchaseWindow.cycleLengthWeeks).toBe(2);
});
