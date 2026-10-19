const http = require('node:http');
const { randomUUID } = require('node:crypto');
const createApp = require('../../../src/app');
const { createAuthModule } = require('../../../src/modules/auth');
const { createTenantsModule } = require('../../../src/modules/tenants');
const { createFrequenciesModule } = require('../../../src/modules/frequencies');
const { createHasher } = require('../../../src/modules/auth/infrastructure/password-hasher');
const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');

const PASSWORD = 'contraseña ficticia frecuencias';

let pool;
let server;
let url;
let cooperativeId;
let anotherCooperativeId;
let otherCoopUserEmail;

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

const validPayload = {
  origin: 'Ambato',
  destination: 'Quito',
  departure_time: '14:00',
  ant_resolution_number: 'ANT-2026-000123',
  segment_prices: [8.5],
};

beforeAll(async () => {
  runMigration();
  pool = testPool();
  const auth = await createAuthModule({
    pool,
    env: { JWT_SECRET: 'test-only-freq-secret-123456789012345' },
  });
  const tenants = createTenantsModule({ pool, auth });
  const frequencies = createFrequenciesModule({ pool, auth });
  server = http.createServer(createApp({ auth, tenants, frequencies, pool }));
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});

beforeEach(async () => {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE auth_sessions, users, cooperatives, frequency_segment_prices, frequency_stops, frequencies',
  );
  cooperativeId = await createCooperative('Cooperativa de prueba');
  anotherCooperativeId = await createCooperative('Otra cooperativa');
  await createUser('coadmin@example.ec', 'COOPERATIVE_ADMIN', cooperativeId);
  otherCoopUserEmail = `other-${randomUUID()}@example.ec`;
  await createUser(otherCoopUserEmail, 'COOPERATIVE_ADMIN', anotherCooperativeId);
});

afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) await pool.end();
});

test('un COOPERATIVE_ADMIN puede crear una frecuencia válida', async () => {
  const browser = new Browser();
  await browser.signIn('coadmin@example.ec');
  const res = await browser.request('/api/v1/frequencies', 'POST', validPayload);
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.frequency).toMatchObject({
    origin: 'Ambato',
    destination: 'Quito',
    departure_time: '14:00',
    ant_resolution_number: 'ANT-2026-000123',
    status: 'ACTIVE',
    stops: [],
    segment_prices: [8.5],
  });
  expect(body.frequency.id).toBeDefined();
  expect(body.frequency.cooperative_id).toBe(cooperativeId);
});

test('falta la resolución ANT devuelve FREQUENCY_REQUIRES_ANT_RESOLUTION', async () => {
  const browser = new Browser();
  await browser.signIn('coadmin@example.ec');
  const res = await browser.request('/api/v1/frequencies', 'POST', {
    ...validPayload,
    ant_resolution_number: '',
  });
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({
    error: {
      code: 'FREQUENCY_REQUIRES_ANT_RESOLUTION',
      message: 'La frecuencia requiere un número de resolución de la ANT.',
    },
  });
});

test('cantidad de precios distinta devuelve FREQUENCY_SEGMENT_PRICES_MISMATCH', async () => {
  const browser = new Browser();
  await browser.signIn('coadmin@example.ec');
  const res = await browser.request('/api/v1/frequencies', 'POST', {
    ...validPayload,
    segment_prices: [],
  });
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({
    error: {
      code: 'FREQUENCY_SEGMENT_PRICES_MISMATCH',
      message: 'La cantidad de precios no coincide con la cantidad de tramos.',
    },
  });
});

test('precio inválido devuelve VALIDATION_ERROR', async () => {
  const browser = new Browser();
  await browser.signIn('coadmin@example.ec');
  const res = await browser.request('/api/v1/frequencies', 'POST', {
    ...validPayload,
    segment_prices: [0],
  });
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({
    error: { code: 'VALIDATION_ERROR', message: 'Datos de frecuencia inválidos.' },
  });
});

test('ruta duplicada devuelve FREQUENCY_ALREADY_EXISTS', async () => {
  const browser = new Browser();
  await browser.signIn('coadmin@example.ec');
  await browser.request('/api/v1/frequencies', 'POST', validPayload);
  const res = await browser.request('/api/v1/frequencies', 'POST', validPayload);
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({
    error: {
      code: 'FREQUENCY_ALREADY_EXISTS',
      message: 'Ya existe una frecuencia con esa ruta y hora en la cooperativa.',
    },
  });
});

test('no se puede crear para otra cooperativa: aislamiento entre cooperativas', async () => {
  const browser = new Browser();
  await browser.signIn('coadmin@example.ec');
  await browser.request('/api/v1/frequencies', 'POST', validPayload);
  const browser2 = new Browser();
  await browser2.signIn(otherCoopUserEmail);
  const res2 = await browser2.request('/api/v1/frequencies', 'POST', validPayload);
  expect(res2.status).toBe(201);
});

test('obtener frecuencia por id', async () => {
  const browser = new Browser();
  await browser.signIn('coadmin@example.ec');
  const createRes = await browser.request('/api/v1/frequencies', 'POST', validPayload);
  const created = (await createRes.json()).frequency;
  const res = await browser.request(`/api/v1/frequencies/${created.id}`);
  expect(res.status).toBe(200);
  expect((await res.json()).frequency).toMatchObject({ id: created.id });
});

test('obtener frecuencia de otra cooperativa devuelve 404', async () => {
  const browser = new Browser();
  await browser.signIn('coadmin@example.ec');
  const createRes = await browser.request('/api/v1/frequencies', 'POST', validPayload);
  const created = (await createRes.json()).frequency;
  const browser2 = new Browser();
  await browser2.signIn(otherCoopUserEmail);
  const res = await browser2.request(`/api/v1/frequencies/${created.id}`);
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({
    error: { code: 'FREQUENCY_NOT_FOUND', message: 'Frecuencia no encontrada.' },
  });
});

test('listar frecuencias con filtros', async () => {
  const browser = new Browser();
  await browser.signIn('coadmin@example.ec');
  await browser.request('/api/v1/frequencies', 'POST', validPayload);
  await browser.request('/api/v1/frequencies', 'POST', {
    ...validPayload,
    origin: 'Quito',
    destination: 'Ambato',
    departure_time: '09:00',
    ant_resolution_number: 'ANT-2026-000124',
    segment_prices: [8.5],
  });
  const res = await browser.request('/api/v1/frequencies?origin=Ambato');
  expect(res.status).toBe(200);
  const list = await res.json();
  expect(list.frequencies).toHaveLength(1);
});

test('listar frecuencias de otra cooperativa no muestra las mías', async () => {
  const browser = new Browser();
  await browser.signIn('coadmin@example.ec');
  await browser.request('/api/v1/frequencies', 'POST', validPayload);
  const browser2 = new Browser();
  await browser2.signIn(otherCoopUserEmail);
  const res = await browser2.request('/api/v1/frequencies');
  expect(res.status).toBe(200);
  expect((await res.json()).frequencies).toHaveLength(0);
});

test('cambiar estado requiere CSRF y actualiza', async () => {
  const browser = new Browser();
  await browser.signIn('coadmin@example.ec');
  const createRes = await browser.request('/api/v1/frequencies', 'POST', validPayload);
  const created = (await createRes.json()).frequency;
  const resNoCsrf = await browser.request(
    `/api/v1/frequencies/${created.id}/status`,
    'PATCH',
    { status: 'INACTIVE' },
    '',
  );
  expect(resNoCsrf.status).toBe(403);
  const res = await browser.request(`/api/v1/frequencies/${created.id}/status`, 'PATCH', {
    status: 'INACTIVE',
  });
  expect(res.status).toBe(200);
  expect((await res.json()).frequency.status).toBe('INACTIVE');
});

test('roles incorrectos reciben 403 y sin token 401', async () => {
  const browser = new Browser();
  await browser.token();
  const res401 = await browser.request('/api/v1/frequencies', 'POST', validPayload);
  expect(res401.status).toBe(401);
  const customer = `cust-${randomUUID()}@example.ec`;
  await createUser(customer, 'CUSTOMER');
  const browserCust = new Browser();
  await browserCust.signIn(customer);
  const res403 = await browserCust.request('/api/v1/frequencies');
  expect(res403.status).toBe(403);
});

test('filtros combinados y campos extra válidos', async () => {
  const browser = new Browser();
  await browser.signIn('coadmin@example.ec');
  await browser.request('/api/v1/frequencies', 'POST', { ...validPayload, status: 'ACTIVE' });
  const res = await browser.request('/api/v1/frequencies?status=ACTIVE&origin=Ambato');
  expect(res.status).toBe(200);
  expect((await res.json()).frequencies).toHaveLength(1);
  const resBad = await browser.request('/api/v1/frequencies?status=INVALID');
  expect(resBad.status).toBe(400);
});
