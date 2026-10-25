const http = require('node:http');
const { randomUUID } = require('node:crypto');
const createApp = require('../../../src/app');
const { createAuthModule } = require('../../../src/modules/auth');
const { createTenantsModule } = require('../../../src/modules/tenants');
const { createFleetModule } = require('../../../src/modules/fleet');
const { createHasher } = require('../../../src/modules/auth/infrastructure/password-hasher');
const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');

const PASSWORD = 'contraseña ficticia fleet';
let pool, hash, server, url, coop1, coop2;

class Browser {
  constructor(email = 'cooperative_admin@example.ec') {
    this.email = email;
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
  async signIn() {
    await this.token();
    const res = await this.request('/api/v1/auth/login', 'POST', { email: this.email, password: PASSWORD });
    expect(res.status).toBe(200);
    await this.token();
  }
  create(body, csrf = this.csrf) {
    return this.request('/api/v1/bus-groups', 'POST', body, csrf);
  }
  list() {
    return this.request('/api/v1/bus-groups');
  }
}

beforeAll(async () => {
  runMigration();
  pool = testPool();
  hash = await (await createHasher()).hash(PASSWORD);
});

beforeEach(async () => {
  assertTestDatabase();
  await pool.query('TRUNCATE auth_sessions, users, bus_groups, cooperatives CASCADE');
  coop1 = (await pool.query("INSERT INTO cooperatives(name, ruc) VALUES ('Coop Uno', '0011111111111') RETURNING id")).rows[0].id;
  coop2 = (await pool.query("INSERT INTO cooperatives(name, ruc) VALUES ('Coop Dos', '0022222222222') RETURNING id")).rows[0].id;

  await pool.query(
    "INSERT INTO users(email, password_hash, role, cooperative_id) VALUES ($1,$2,'SYSTEM_ADMIN',NULL)",
    ['system_admin@example.ec', hash],
  );
  await pool.query(
    "INSERT INTO users(email, password_hash, role, cooperative_id) VALUES ($1,$2,'CUSTOMER',NULL)",
    ['customer@example.ec', hash],
  );
  await pool.query(
    "INSERT INTO users(email, password_hash, role, cooperative_id) VALUES ($1,$2,'CLERK',$3)",
    ['clerk@example.ec', hash, coop1],
  );
  await pool.query(
    "INSERT INTO users(email, password_hash, role, cooperative_id) VALUES ($1,$2,'COOPERATIVE_ADMIN',$3)",
    ['cooperative_admin@example.ec', hash, coop1],
  );
  await pool.query(
    "INSERT INTO users(email, password_hash, role, cooperative_id) VALUES ($1,$2,'COOPERATIVE_ADMIN',$3)",
    ['cooperative_admin2@example.ec', hash, coop2],
  );

  const auth = await createAuthModule({ pool, env: { JWT_SECRET: 'test-only-fleet-secret-not-for-production-12345' } });
  const tenants = createTenantsModule({ pool, auth });
  const fleet = createFleetModule({ pool, auth });
  server = http.createServer(createApp({ auth, tenants, fleet, pool }));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  url = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

afterAll(async () => {
  if (pool) await pool.end();
});

async function countGroups(cooperativeId) {
  return (await pool.query('SELECT count(*)::int AS count FROM bus_groups WHERE cooperative_id = $1', [cooperativeId])).rows[0].count;
}

test('COOPERATIVE_ADMIN crea grupo con CSRF válido y persiste en su cooperativa', async () => {
  const browser = new Browser();
  await browser.signIn();
  const before = await countGroups(coop1);
  const res = await browser.create({ name: '  Rutas largas  ', category: '  LONG_ROUTE  ' });
  expect(res.status).toBe(201);
  const { busGroup } = await res.json();
  expect(busGroup).toEqual({
    id: expect.any(String),
    name: 'Rutas largas',
    category: 'LONG_ROUTE',
    created_at: expect.any(String),
    updated_at: expect.any(String),
  });
  expect(busGroup.cooperative_id).toBeUndefined();
  expect(await countGroups(coop1)).toBe(before + 1);
  const row = (await pool.query('SELECT * FROM bus_groups WHERE id = $1', [busGroup.id])).rows[0];
  expect(row.cooperative_id).toBe(coop1);
});

test('sin sesión, sesión revocada o vencida no permite crear', async () => {
  const browser = new Browser();
  const before = await countGroups(coop1);
  expect((await browser.create({ name: 'Grupo X', category: 'LONG_ROUTE' })).status).toBe(401);

  await browser.signIn();
  await pool.query('UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP');
  expect((await browser.create({ name: 'Grupo X', category: 'LONG_ROUTE' })).status).toBe(401);

  await pool.query("UPDATE auth_sessions SET revoked_at = NULL, expires_at = CURRENT_TIMESTAMP - interval '1 minute'");
  expect((await browser.create({ name: 'Grupo X', category: 'LONG_ROUTE' })).status).toBe(401);

  expect(await countGroups(coop1)).toBe(before);
});

test.each(['SYSTEM_ADMIN', 'CUSTOMER', 'CLERK'])('%s recibe 403 y no escribe', async (role) => {
  const email = `${role.toLowerCase()}@example.ec`;
  const browser = new Browser(email);
  await browser.signIn();
  const before = await countGroups(coop1);
  expect((await browser.create({ name: 'Grupo Rol', category: 'LONG_ROUTE' })).status).toBe(403);
  expect(await countGroups(coop1)).toBe(before);
});

test('CSRF ausente o manipulado bloquea la creación', async () => {
  const browser = new Browser();
  await browser.signIn();
  const before = await countGroups(coop1);
  expect((await browser.create({ name: 'Grupo CSRF', category: 'LONG_ROUTE' }, '')).status).toBe(403);
  expect((await browser.create({ name: 'Grupo CSRF', category: 'LONG_ROUTE' }, 'fake')).status).toBe(403);
  expect(await countGroups(coop1)).toBe(before);
});

test('datos inválidos devuelven 400', async () => {
  const browser = new Browser();
  await browser.signIn();
  const before = await countGroups(coop1);
  const bodies = [
    {},
    { name: ' ' },
    { name: 'Grupo', category: 'OTRA' },
    { name: 'Grupo', category: 123 },
    { name: 123, category: 'LONG_ROUTE' },
    { name: 'Grupo', category: 'LONG_ROUTE', extra: 'x' },
    { name: 'Grupo', category: 'LONG_ROUTE', cooperative_id: randomUUID() },
  ];
  for (const body of bodies) {
    const res = await browser.create(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
  }
  // cuerpo vacío real
  const emptyRes = await browser.request('/api/v1/bus-groups', 'POST', undefined);
  expect(emptyRes.status).toBe(400);
  expect(await countGroups(coop1)).toBe(before);
});

test('nombre duplicado en la misma cooperativa devuelve 409', async () => {
  const browser = new Browser();
  await browser.signIn();
  expect((await browser.create({ name: 'Rutas Largas', category: 'LONG_ROUTE' })).status).toBe(201);
  const dup = await browser.create({ name: 'rutas largas', category: 'CANTONAL' });
  expect(dup.status).toBe(409);
  expect((await dup.json()).error.code).toBe('BUS_GROUP_ALREADY_EXISTS');
  expect(await countGroups(coop1)).toBe(1);
});

test('dos solicitudes concurrentes con el mismo nombre: un 201 y un 409, una sola fila', async () => {
  const browser = new Browser();
  await browser.signIn();
  const body = { name: 'Concurrente', category: 'LONG_ROUTE' };
  const results = await Promise.all([browser.create(body), browser.create(body)]);
  expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(await countGroups(coop1)).toBe(1);
});

test('el mismo nombre en otra cooperativa sí se permite', async () => {
  const admin1 = new Browser();
  await admin1.signIn();
  expect((await admin1.create({ name: 'Compartido', category: 'LONG_ROUTE' })).status).toBe(201);

  const admin2 = new Browser('cooperative_admin2@example.ec');
  await admin2.signIn();
  expect((await admin2.create({ name: 'Compartido', category: 'CANTONAL' })).status).toBe(201);
  expect(await countGroups(coop1)).toBe(1);
  expect(await countGroups(coop2)).toBe(1);
});

test('GET sin sesión devuelve 401', async () => {
  const browser = new Browser();
  expect((await browser.list()).status).toBe(401);
});

test.each(['SYSTEM_ADMIN', 'CUSTOMER', 'CLERK'])('GET con %s devuelve 403', async (role) => {
  const email = `${role.toLowerCase()}@example.ec`;
  const browser = new Browser(email);
  await browser.signIn();
  expect((await browser.list()).status).toBe(403);
});

test('GET devuelve solo los grupos de la cooperativa del usuario, ordenados', async () => {
  const admin1 = new Browser();
  await admin1.signIn();
  await admin1.create({ name: 'Zeta', category: 'LONG_ROUTE' });
  await admin1.create({ name: 'Alpha', category: 'CANTONAL' });

  const admin2 = new Browser('cooperative_admin2@example.ec');
  await admin2.signIn();
  await admin2.create({ name: 'Beta', category: 'URBAN_RURAL' });

  const res1 = await admin1.list();
  expect(res1.status).toBe(200);
  const { busGroups: groups1 } = await res1.json();
  expect(groups1.map((g) => g.name)).toEqual(['Alpha', 'Zeta']);
  for (const g of groups1) expect(g.cooperative_id).toBeUndefined();

  const res2 = await admin2.list();
  expect(res2.status).toBe(200);
  const { busGroups: groups2 } = await res2.json();
  expect(groups2.map((g) => g.name)).toEqual(['Beta']);
});

test('GET devuelve lista vacía si no hay grupos', async () => {
  const browser = new Browser();
  await browser.signIn();
  const res = await browser.list();
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ busGroups: [] });
});
