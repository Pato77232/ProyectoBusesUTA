const http = require('node:http');
const createApp = require('../../src/app');
const { createAuthModule } = require('../../src/modules/auth');
const { createHasher } = require('../../src/modules/auth/infrastructure/password-hasher');
const PgAuthRepository = require('../../src/modules/auth/infrastructure/pg-auth.repository');
const { runMigration, testPool } = require('../helpers/database');
const { assertTestDatabase } = require('../../scripts/test-database');
const SessionBrowser = require('../helpers/session-browser');

const PASSWORD = 'contraseña ficticia de prueba';
const env = { JWT_SECRET: 'test-only-clerk-secret-not-for-production-12345' };
const clerkPath = '/api/v1/auth/clerks';
let pool;
let server;
let baseUrl;
let cooperativeId;
let otherCooperativeId;
let passwordHash;

async function seedIdentity(role, cooperative = cooperativeId) {
  const email = `${role.toLowerCase()}@example.ec`;
  await pool.query(
    'INSERT INTO users(email,password_hash,role,cooperative_id) VALUES($1,$2,$3,$4)',
    [
      email,
      passwordHash,
      role,
      role === 'COOPERATIVE_ADMIN' || role === 'CLERK' ? cooperative : null,
    ],
  );
  return email;
}

async function signIn(role = 'COOPERATIVE_ADMIN') {
  const browser = new SessionBrowser(baseUrl);
  await browser.login(`${role.toLowerCase()}@example.ec`, PASSWORD);
  return browser;
}

async function users(email) {
  return (await pool.query('SELECT * FROM users WHERE email=$1', [email])).rows;
}

beforeAll(async () => {
  runMigration();
  pool = testPool();
  passwordHash = await (await createHasher()).hash(PASSWORD);
});

beforeEach(async () => {
  assertTestDatabase();
  await pool.query('TRUNCATE auth_sessions, users, cooperatives CASCADE');
  cooperativeId = (
    await pool.query('INSERT INTO cooperatives(name,ruc) VALUES($1,$2) RETURNING id', [
      'Cooperativa principal',
      '0012345678901',
    ])
  ).rows[0].id;
  otherCooperativeId = (
    await pool.query('INSERT INTO cooperatives(name,ruc) VALUES($1,$2) RETURNING id', [
      'Cooperativa ajena',
      '0012345678902',
    ])
  ).rows[0].id;
  for (const role of ['SYSTEM_ADMIN', 'CUSTOMER', 'COOPERATIVE_ADMIN', 'CLERK']) {
    await seedIdentity(role);
  }
  const auth = await createAuthModule({ pool, env });
  server = http.createServer(createApp({ auth, pool }));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

afterAll(async () => {
  if (pool) await pool.end();
});

const body = { email: 'nuevo@example.ec', password: PASSWORD };

test('crea CLERK solo en su cooperativa y permite login sin crear sesión automática', async () => {
  const admin = await signIn();
  const sessionsBefore = (await pool.query('SELECT * FROM auth_sessions')).rows;
  const response = await admin.request(clerkPath, 'POST', {
    ...body,
    email: ' NUEVO@EXAMPLE.EC ',
  });
  expect(response.status).toBe(201);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.getSetCookie()).toEqual([]);
  const { user } = await response.json();
  expect(user).toEqual({
    id: expect.any(String),
    email: body.email,
    role: 'CLERK',
    cooperative_id: cooperativeId,
  });
  expect((await pool.query('SELECT * FROM auth_sessions')).rows).toEqual(sessionsBefore);
  const row = (await users(body.email))[0];
  expect(row.password_hash).toMatch(/^\$argon2id\$/);
  expect(row.password_hash).not.toBe(PASSWORD);
  const clerk = new SessionBrowser(baseUrl);
  await clerk.login(body.email, PASSWORD);
  expect(await (await clerk.request('/api/v1/auth/me')).json()).toEqual({ user });
});

test.each(['SYSTEM_ADMIN', 'CUSTOMER', 'CLERK'])('%s no puede crear oficinistas', async (role) => {
  const browser = await signIn(role);
  expect((await browser.request(clerkPath, 'POST', body)).status).toBe(403);
  expect(await users(body.email)).toHaveLength(0);
});

test('sesión ausente, revocada o vencida impide el alta', async () => {
  const anonymous = new SessionBrowser(baseUrl);
  expect((await anonymous.request(clerkPath, 'POST', body)).status).toBe(401);
  const browser = await signIn();
  await pool.query('UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP');
  expect((await browser.request(clerkPath, 'POST', body)).status).toBe(401);
  await pool.query(
    "UPDATE auth_sessions SET revoked_at=NULL, expires_at=CURRENT_TIMESTAMP-interval '1 minute'",
  );
  expect((await browser.request(clerkPath, 'POST', body)).status).toBe(401);
  expect(await users(body.email)).toHaveLength(0);
});

test('CSRF, cuerpo y cooperativa manipulados no crean usuarios', async () => {
  const browser = await signIn();
  for (const csrf of ['', 'incorrecto']) {
    expect((await browser.request(clerkPath, 'POST', body, csrf)).status).toBe(403);
  }
  for (const invalid of [
    {},
    { ...body, password: 'corta' },
    { ...body, role: 'SYSTEM_ADMIN' },
    { ...body, cooperative_id: otherCooperativeId },
  ]) {
    expect((await browser.request(clerkPath, 'POST', invalid)).status).toBe(400);
  }
  expect(await users(body.email)).toHaveLength(0);
});

test('email duplicado y dos altas simultáneas crean como máximo una cuenta', async () => {
  const browser = await signIn();
  const responses = await Promise.all([
    browser.request(clerkPath, 'POST', body),
    browser.request(clerkPath, 'POST', { ...body, email: ' NUEVO@EXAMPLE.EC ' }),
  ]);
  expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
  expect(await users(body.email)).toHaveLength(1);
  const duplicate = await browser.request(clerkPath, 'POST', {
    ...body,
    email: ' CUSTOMER@EXAMPLE.EC ',
  });
  expect(duplicate.status).toBe(409);
  expect((await duplicate.json()).error.code).toBe('REGISTRATION_CONFLICT');
  expect((await users('customer@example.ec'))[0].role).toBe('CUSTOMER');
});

test('la FK rechaza una cooperativa inexistente sin crear CLERK', async () => {
  const repository = new PgAuthRepository(pool);
  await expect(
    repository.createClerk({
      cooperativeId: '00000000-0000-4000-8000-000000000000',
      email: body.email,
      passwordHash,
    }),
  ).rejects.toMatchObject({ code: 'COOPERATIVE_NOT_FOUND' });
  expect(await users(body.email)).toHaveLength(0);
});
