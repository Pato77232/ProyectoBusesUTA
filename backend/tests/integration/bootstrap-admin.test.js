const { spawn } = require('node:child_process');
const path = require('node:path');
const http = require('node:http');
const { runMigration, testPool, clearAuth } = require('../helpers/database');
const { bootstrapSystemAdmin, createAuthModule } = require('../../src/modules/auth');
const createApp = require('../../src/app');
const { createHasher } = require('../../src/modules/auth/infrastructure/password-hasher');
const credentials = { email: ' Inicial@EXAMPLE.EC ', password: 'contraseña de pruebas inicial' };
let pool;
beforeAll(() => {
  runMigration();
  pool = testPool();
});
beforeEach(async () => {
  await clearAuth(pool);
});
afterAll(async () => {
  await pool.end();
});
async function users() {
  return (await pool.query('SELECT * FROM users ORDER BY id')).rows;
}
function cli(input, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(__dirname, '../../scripts/bootstrap-admin.js')],
      { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let stdout = '',
      stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(JSON.stringify(input));
  });
}
test('CLI crea administrador sin sesión, guarda hash válido y permite login', async () => {
  const result = await cli(credentials);
  expect(result.code).toBe(0);
  expect(result.stdout).toBe('Administrador inicial creado.\n');
  expect(result.stderr).toBe('');
  const rows = await users();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    email: 'inicial@example.ec',
    role: 'SYSTEM_ADMIN',
    cooperative_id: null,
  });
  expect(rows[0].password_hash).toMatch(/^\$argon2id\$/);
  expect(await (await createHasher()).verify(rows[0].password_hash, credentials.password)).toBe(
    true,
  );
  expect((await pool.query('SELECT * FROM auth_sessions')).rows).toHaveLength(0);
  const auth = await createAuthModule({
    pool,
    env: { JWT_SECRET: 'test-only-bootstrap-secret-at-least-32-characters' },
  });
  const server = http.createServer(createApp({ auth }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    const csrfResponse = await fetch(url + '/api/v1/auth/csrf');
    const { csrfToken } = await csrfResponse.json();
    const cookie = csrfResponse.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
    const response = await fetch(url + '/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken, cookie },
      body: JSON.stringify(credentials),
    });
    expect(response.status).toBe(200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test('repetir con otros datos no modifica usuarios ni sesiones', async () => {
  await bootstrapSystemAdmin({ pool, credentials });
  const before = await users();
  const result = await cli({
    email: 'otro@example.ec',
    password: 'contraseña diferente de prueba',
  });
  expect(result.code).toBe(0);
  expect(result.stdout).toContain('no se modificaron cuentas');
  expect(await users()).toEqual(before);
  expect((await pool.query('SELECT * FROM auth_sessions')).rows).toHaveLength(0);
});
test('email normalizado ocupado no convierte al cliente y libera la transacción', async () => {
  await pool.query(
    "INSERT INTO users(email,password_hash,role) VALUES('inicial@example.ec','hash-ficticio','CUSTOMER')",
  );
  const before = await users();
  const result = await cli(credentials);
  expect(result.code).toBe(1);
  expect(result.stderr).not.toContain(credentials.password);
  expect(await users()).toEqual(before);
  expect(
    await bootstrapSystemAdmin({
      pool,
      credentials: { ...credentials, email: 'libre@example.ec' },
    }),
  ).toEqual({ created: true });
});
test('dos comandos simultáneos crean exactamente un administrador', async () => {
  const results = await Promise.all([
    cli(credentials),
    cli({ ...credentials, email: 'otro@example.ec' }),
  ]);
  expect(results.map((r) => r.code)).toEqual([0, 0]);
  expect(results.filter((r) => r.stdout === 'Administrador inicial creado.\n')).toHaveLength(1);
  expect(await users()).toHaveLength(1);
});
test('CLI rechaza datos inválidos y no expone secretos en fallos operativos', async () => {
  for (const input of [
    {},
    { ...credentials, password: 'corta' },
    { ...credentials, role: 'CUSTOMER' },
  ])
    expect((await cli(input)).code).toBe(1);
  const result = await cli(credentials, {
    DATABASE_URL: 'postgresql://test:secret-test-only@127.0.0.1:1/unavailable_test',
  });
  expect(result.code).toBe(1);
  expect(result.stdout + result.stderr).not.toContain('secret-test-only');
  expect(result.stdout + result.stderr).not.toContain(credentials.password);
  expect(await users()).toHaveLength(0);
});
