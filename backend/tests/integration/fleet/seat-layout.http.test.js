const http = require('node:http');
const { start } = require('../../../src/server');
const { createFleetModule } = require('../../../src/modules/fleet');
const { createHasher } = require('../../../src/modules/auth/infrastructure/password-hasher');
const StaticSeatLayoutCatalog = require('../../../src/modules/fleet/infrastructure/static-seat-layout-catalog');
const { InvalidSeatLayoutError } = require('../../../src/modules/fleet/domain/seat-layout');
const { runMigration } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');

const PASSWORD = 'contraseña ficticia catálogo fleet';
const ENDPOINT = '/api/v1/seat-layouts';
let pool, server, baseUrl, hash;
let previousSignals;

async function freePort() {
  const temporary = http.createServer();
  await new Promise((resolve) => temporary.listen(0, '127.0.0.1', resolve));
  const { port } = temporary.address();
  await new Promise((resolve) => temporary.close(resolve));
  return port;
}

class Browser {
  constructor() {
    this.cookies = new Map();
  }
  async request(path, options = {}) {
    const headers = {
      cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; '),
      ...options.headers,
    };
    const response = await fetch(baseUrl + path, { ...options, headers });
    for (const value of response.headers.getSetCookie()) {
      const cookie = value.split(';')[0];
      const separator = cookie.indexOf('=');
      this.cookies.set(cookie.slice(0, separator), cookie.slice(separator + 1));
    }
    return response;
  }
  async signIn(email = 'cooperative_admin@example.ec') {
    const csrf = await (await this.request('/api/v1/auth/csrf')).json();
    const response = await this.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.csrfToken },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    expect(response.status).toBe(200);
    // GET de lectura solo necesita la sesión, no cookies ni cabecera CSRF.
    this.cookies = new Map([...this.cookies].filter(([key]) => key === 'access_token'));
  }
  list() {
    return this.request(ENDPOINT);
  }
}

beforeAll(async () => {
  runMigration();
  hash = await (await createHasher()).hash(PASSWORD);
  previousSignals = new Map(
    ['SIGINT', 'SIGTERM'].map((signal) => [signal, process.listeners(signal)]),
  );
  const running = await start({
    DATABASE_URL: assertTestDatabase(),
    JWT_SECRET: 'test-only-layouts-secret-not-for-production-12345',
    NODE_ENV: 'test',
    PORT: String(await freePort()),
  });
  server = running.server;
  pool = running.pool;
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  assertTestDatabase();
  await pool.query('TRUNCATE auth_sessions, users, cooperatives CASCADE');
  const cooperatives = (
    await pool.query(
      "INSERT INTO cooperatives(name, ruc) VALUES ('Catálogo A','0011111111111'), ('Catálogo B','0022222222222') RETURNING id",
    )
  ).rows;
  for (const role of ['SYSTEM_ADMIN', 'CUSTOMER', 'CLERK', 'COOPERATIVE_ADMIN']) {
    const cooperativeId = ['CLERK', 'COOPERATIVE_ADMIN'].includes(role) ? cooperatives[0].id : null;
    await pool.query(
      'INSERT INTO users(email,password_hash,role,cooperative_id) VALUES($1,$2,$3,$4)',
      [`${role.toLowerCase()}@example.ec`, hash, role, cooperativeId],
    );
  }
  await pool.query(
    "INSERT INTO users(email,password_hash,role,cooperative_id) VALUES($1,$2,'COOPERATIVE_ADMIN',$3)",
    ['second@example.ec', hash, cooperatives[1].id],
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) await pool.end();
  if (previousSignals) {
    for (const [signal, listeners] of previousSignals) {
      for (const listener of process.listeners(signal)) {
        if (!listeners.includes(listener)) process.removeListener(signal, listener);
      }
    }
  }
});

function seatRows(floor) {
  return Array.from({ length: floor.rows }, (_, row) =>
    floor.elements
      .filter((element) => element.kind === 'SEAT' && element.row === row)
      .sort((a, b) => a.column - b.column)
      .map((element) => element.label),
  );
}

test('el servidor real entrega las tres bases completas al administrador sin CSRF de mutación', async () => {
  const browser = new Browser();
  await browser.signIn();
  const response = await browser.list();
  expect(response.status).toBe(200);
  const { seatLayouts } = await response.json();
  expect(
    seatLayouts.map(({ id, version, capacity, decks }) => ({
      id,
      version,
      capacity,
      floors: decks.map((floor) => [
        floor.number,
        floor.elements.filter((entry) => entry.kind === 'SEAT').length,
      ]),
    })),
  ).toEqual([
    { id: 'SINGLE_DECK_2_2', version: 1, capacity: 42, floors: [[1, 42]] },
    {
      id: 'DOUBLE_DECK_2_2',
      version: 1,
      capacity: 60,
      floors: [
        [2, 44],
        [1, 16],
      ],
    },
    {
      id: 'DOUBLE_DECK_2_1',
      version: 1,
      capacity: 46,
      floors: [
        [2, 34],
        [1, 12],
      ],
    },
  ]);
  expect(seatRows(seatLayouts[0].decks[0])[0]).toEqual([1, 2, 4, 3]);
  expect(seatRows(seatLayouts[0].decks[0])[10]).toEqual([41, 42]);
  expect(seatRows(seatLayouts[1].decks[0]).slice(0, 4)).toEqual([
    [1, 2, 4, 3],
    [5, 6],
    [7, 8],
    [9, 10, 12, 11],
  ]);
  expect(seatRows(seatLayouts[1].decks[1])[1]).toEqual([45, 46, 48, 47]);
  expect(seatRows(seatLayouts[2].decks[0])[0]).toEqual([1, 2, 3]);
  expect(seatRows(seatLayouts[2].decks[0])[11]).toEqual([32, 33, 34]);
  expect(seatRows(seatLayouts[2].decks[1])[1]).toEqual([35, 36, 37]);
  expect(seatRows(seatLayouts[2].decks[1])[4]).toEqual([44, 45, 46]);
  for (const layout of seatLayouts) {
    expect(Object.keys(layout).sort()).toEqual([
      'arrangement',
      'capacity',
      'decks',
      'id',
      'name',
      'version',
    ]);
    for (const floor of layout.decks) {
      for (const element of floor.elements) {
        expect(element.key).toEqual(expect.any(String));
        expect(Number.isInteger(element.row) && Number.isInteger(element.column)).toBe(true);
        if (element.kind === 'SEAT') expect(element.category).toBe('NORMAL');
        else expect(element.label).toBeUndefined();
      }
    }
  }
  expect(seatLayouts[2].decks[0].elements).toContainEqual(
    expect.objectContaining({ kind: 'STAIRS', row: 1, column: 3, rowSpan: 2 }),
  );
  expect((await browser.list()).status).toBe(200);
});

test('sin sesión no entrega el catálogo', async () => {
  const response = await new Browser().list();
  expect(response.status).toBe(401);
  expect((await response.json()).error.code).toBe('UNAUTHENTICATED');
});

test.each(['SYSTEM_ADMIN', 'CUSTOMER', 'CLERK'])('%s no consulta el catálogo', async (role) => {
  const browser = new Browser();
  await browser.signIn(`${role.toLowerCase()}@example.ec`);
  const response = await browser.list();
  expect(response.status).toBe(403);
  expect((await response.json()).error.code).toBe('FORBIDDEN');
});

test.each(['revoked', 'expired'])('la sesión %s no entrega catálogo', async (state) => {
  const browser = new Browser();
  await browser.signIn();
  if (state === 'revoked')
    await pool.query('UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP');
  else
    await pool.query("UPDATE auth_sessions SET expires_at=CURRENT_TIMESTAMP-interval '1 minute'");
  expect((await browser.list()).status).toBe(401);
});

test('dos cooperativas reciben solo las mismas bases comunes sin modificar datos persistidos', async () => {
  const first = new Browser();
  const second = new Browser();
  await first.signIn();
  await second.signIn('second@example.ec');
  const before = await pool.query('SELECT * FROM bus_groups ORDER BY id');
  const sessions = await pool.query('SELECT * FROM auth_sessions ORDER BY id');
  const left = await (await first.list()).json();
  const right = await (await second.list()).json();
  expect(left).toEqual(right);
  expect((await pool.query('SELECT * FROM bus_groups ORDER BY id')).rows).toEqual(before.rows);
  expect((await pool.query('SELECT * FROM auth_sessions ORDER BY id')).rows).toEqual(sessions.rows);
  left.seatLayouts[0].decks[0].elements[0].label = 999;
  expect(await (await first.list()).json()).toEqual(right);
});

test('fallo del catálogo responde 500 genérico sin detalles ni éxito parcial', async () => {
  const browser = new Browser();
  await browser.signIn();
  jest
    .spyOn(StaticSeatLayoutCatalog.prototype, 'list')
    .mockRejectedValueOnce(new InvalidSeatLayoutError());
  const response = await browser.list();
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor.' },
  });
});

test('API pública ofrece lectura completa sin consultar inventario privado', async () => {
  const unusedPool = { query: jest.fn() };
  const auth = { authenticate: jest.fn(), authorize: () => jest.fn(), csrfProtection: jest.fn() };
  const fleet = createFleetModule({ pool: unusedPool, auth });
  const data = await fleet.seatLayoutQueries.list();
  expect(data.map((entry) => entry.capacity)).toEqual([42, 60, 46]);
  expect(unusedPool.query).not.toHaveBeenCalled();
});
