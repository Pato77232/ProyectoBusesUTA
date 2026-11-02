const http = require('node:http');
const { randomUUID } = require('node:crypto');
const createApp = require('../../../src/app');
const { createAuthModule } = require('../../../src/modules/auth');
const { createFrequenciesModule } = require('../../../src/modules/frequencies');
const { createRouteSheetsModule } = require('../../../src/modules/route-sheets');
const { createHasher } = require('../../../src/modules/auth/infrastructure/password-hasher');
const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const configureFactory = require('../../../src/modules/route-sheets/application/use-cases/configure-route-sheet-tariff.use-case');
const PgTariffRepository = require('../../../src/modules/route-sheets/infrastructure/repositories/pg-route-sheet-tariff-repository');

const PASSWORD = 'solo pruebas tarifario 2026';
let pool, server, url, hash, admin, clerk, other, fixture, frequencyQueries;

class Browser {
  constructor() {
    this.cookies = new Map();
    this.csrf = '';
  }
  async request(path, method = 'GET', body, csrf = this.csrf) {
    const headers = {
      cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; '),
      'Content-Type': 'application/json',
    };
    if (method !== 'GET') headers['X-CSRF-Token'] = csrf;
    const response = await fetch(url + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [part] = cookie.split(';');
      const i = part.indexOf('=');
      this.cookies.set(part.slice(0, i), part.slice(i + 1));
    }
    return response;
  }
  async token() {
    this.csrf = (await (await this.request('/api/v1/auth/csrf')).json()).csrfToken;
  }
  async login(email) {
    await this.token();
    const response = await this.request('/api/v1/auth/login', 'POST', {
      email,
      password: PASSWORD,
    });
    if (response.status !== 200) throw new Error('No se pudo autenticar fixture de tarifario.');
    await this.token();
  }
}

async function addUser(email, role, cooperativeId) {
  const { rows } = await pool.query(
    'INSERT INTO users(email,password_hash,role,cooperative_id) VALUES($1,$2,$3,$4) RETURNING id',
    [email, hash, role, cooperativeId],
  );
  return rows[0].id;
}

async function createFixture(name) {
  const cooperativeId = (
    await pool.query('INSERT INTO cooperatives(name,ruc) VALUES($1,$2) RETURNING id', [
      name,
      randomUUID().replace(/\D/g, '').slice(0, 13).padEnd(13, '1'),
    ])
  ).rows[0].id;
  const groupId = (
    await pool.query(
      "INSERT INTO bus_groups(cooperative_id,name,category) VALUES($1,$2,'LONG_ROUTE') RETURNING id",
      [cooperativeId, name],
    )
  ).rows[0].id;
  const frequencyId = (
    await pool.query(
      `INSERT INTO frequencies(cooperative_id,origin,destination,departure_time,ant_resolution_number)
    VALUES($1,'Ambato','Quito','07:00','ANT-FICTICIA') RETURNING id`,
      [cooperativeId],
    )
  ).rows[0].id;
  await pool.query(
    "INSERT INTO frequency_stops(frequency_id,position,place) VALUES($1,1,'Latacunga')",
    [frequencyId],
  );
  const routeSheetId = (
    await pool.query(
      "INSERT INTO route_sheets(cooperative_id,bus_group_id,route_date) VALUES($1,$2,'2026-11-02') RETURNING id",
      [cooperativeId, groupId],
    )
  ).rows[0].id;
  await pool.query(
    `INSERT INTO route_sheet_assignments(route_sheet_id,cooperative_id,bus_group_id,bus_id,frequency_id)
    VALUES($1,$2,$3,$4,$5)`,
    [routeSheetId, cooperativeId, groupId, randomUUID(), frequencyId],
  );
  return { cooperativeId, groupId, frequencyId, routeSheetId };
}

function body(expectedRevision = 0) {
  return {
    expectedRevision,
    policy: {
      vipSurchargeBps: 2500,
      minorDiscountBps: 5000,
      seniorDiscountBps: 5000,
      disabilityDiscountBps: 5000,
    },
    frequencies: [
      {
        frequencyId: fixture.frequencyId,
        prices: [
          { fromPosition: 0, toPosition: 1, amountCents: 200 },
          { fromPosition: 0, toPosition: 2, amountCents: 450 },
          { fromPosition: 1, toPosition: 2, amountCents: 300 },
        ],
      },
    ],
  };
}
const path = () => `/api/v1/route-sheets/${fixture.routeSheetId}/tariff`;
const row = async () =>
  (
    await pool.query('SELECT tariff_revision,tariff_draft FROM route_sheets WHERE id=$1', [
      fixture.routeSheetId,
    ])
  ).rows[0];

beforeAll(async () => {
  runMigration();
  pool = testPool();
  hash = await (await createHasher()).hash(PASSWORD);
  const auth = await createAuthModule({
    pool,
    env: { JWT_SECRET: 'tariff-tests-only-secret-12345678901234567890' },
  });
  const frequencies = createFrequenciesModule({ pool, auth });
  frequencyQueries = frequencies.frequencyQueries;
  const routeSheets = createRouteSheetsModule({
    pool,
    auth,
    frequencyQueries,
    busGroupQueries: { findById: async () => null, findByCooperativeId: async () => [] },
  });
  server = http.createServer(createApp({ auth, frequencies, routeSheets, pool }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE route_sheets, bus_groups, auth_sessions, users, frequencies, cooperatives CASCADE',
  );
  fixture = await createFixture('Cooperativa ficticia');
  fixture.adminId = await addUser(
    'tariff-admin@example.ec',
    'COOPERATIVE_ADMIN',
    fixture.cooperativeId,
  );
  await addUser('tariff-clerk@example.ec', 'CLERK', fixture.cooperativeId);
  const foreign = await createFixture('Otra ficticia');
  await addUser('tariff-other@example.ec', 'COOPERATIVE_ADMIN', foreign.cooperativeId);
  admin = new Browser();
  clerk = new Browser();
  other = new Browser();
  await admin.login('tariff-admin@example.ec');
});

afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) await pool.end();
});

test('guarda y reemplaza borrador con recorrido real y revisión creciente', async () => {
  let response = await admin.request(path(), 'PUT', body());
  expect(response.status).toBe(200);
  const first = (await response.json()).tariff;
  expect(first).toMatchObject({
    revision: 1,
    cooperativeId: fixture.cooperativeId,
    updatedBy: fixture.adminId,
  });
  expect(first.tariff.frequencies[0].routePoints).toEqual(['Ambato', 'Latacunga', 'Quito']);
  const replacement = body(1);
  replacement.frequencies[0].prices[1].amountCents = 475;
  response = await admin.request(path(), 'PUT', replacement);
  expect(response.status).toBe(200);
  expect((await response.json()).tariff.revision).toBe(2);
  expect((await row()).tariff_draft.frequencies[0].prices[1].amountCents).toBe(475);
});

test('dos ediciones simultáneas con revisión cero no se sobrescriben', async () => {
  const responses = await Promise.all([
    admin.request(path(), 'PUT', body()),
    admin.request(path(), 'PUT', body()),
  ]);
  expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
  expect((await row()).tariff_revision).toBe(1);
});

test('revisión desactualizada conserva matriz anterior', async () => {
  expect((await admin.request(path(), 'PUT', body())).status).toBe(200);
  const stale = body();
  stale.frequencies[0].prices[1].amountCents = 900;
  const response = await admin.request(path(), 'PUT', stale);
  expect(response.status).toBe(409);
  expect((await response.json()).error.code).toBe('ROUTE_TARIFF_REVISION_CONFLICT');
  expect((await row()).tariff_draft.frequencies[0].prices[1].amountCents).toBe(450);
});

test('rechaza hoja publicada sin modificar el tarifario', async () => {
  await pool.query("UPDATE route_sheets SET status='PUBLISHED' WHERE id=$1", [
    fixture.routeSheetId,
  ]);
  expect((await admin.request(path(), 'PUT', body())).status).toBe(409);
  expect((await row()).tariff_revision).toBe(0);
});

test('aísla hoja de otra cooperativa y exige sesión, rol y CSRF', async () => {
  await other.login('tariff-other@example.ec');
  await clerk.login('tariff-clerk@example.ec');
  expect((await other.request(path(), 'PUT', body())).status).toBe(404);
  expect((await clerk.request(path(), 'PUT', body())).status).toBe(403);
  expect((await new Browser().request(path(), 'PUT', body())).status).toBe(401);
  expect((await admin.request(path(), 'PUT', body(), 'incorrecto')).status).toBe(403);
  expect((await row()).tariff_draft).toBeNull();
});

test.each(['cooperativeId', 'routePoints', 'revision'])(
  'no permite que el body imponga %s',
  async (field) => {
    expect((await admin.request(path(), 'PUT', { ...body(), [field]: 'inyectado' })).status).toBe(
      400,
    );
    expect((await row()).tariff_revision).toBe(0);
  },
);

test('matriz incompleta o frecuencia no asignada revierte sin tarifa parcial', async () => {
  const incomplete = body();
  incomplete.frequencies[0].prices.pop();
  expect((await admin.request(path(), 'PUT', incomplete)).status).toBe(409);
  const wrong = body();
  wrong.frequencies[0].frequencyId = randomUUID();
  expect((await admin.request(path(), 'PUT', wrong)).status).toBe(409);
  expect((await row()).tariff_draft).toBeNull();
});

test('frecuencia inactiva no se configura', async () => {
  await pool.query("UPDATE frequencies SET status='INACTIVE' WHERE id=$1", [fixture.frequencyId]);
  expect((await admin.request(path(), 'PUT', body())).status).toBe(409);
  expect((await row()).tariff_revision).toBe(0);
});

test('rollback conserva revisión y datos si falla después de guardar', async () => {
  const repository = new PgTariffRepository(pool);
  const failure = new Error('Fallo ficticio después del UPDATE');
  await expect(
    repository.withLockedSheet({ ...fixture, modifiedBy: fixture.adminId }, async ({ save }) => {
      await save({ currency: 'USD', prueba: true });
      throw failure;
    }),
  ).rejects.toBe(failure);
  expect(await row()).toEqual({ tariff_revision: 0, tariff_draft: null });
});

test('un fallo del proveedor libera la transacción sin datos parciales', async () => {
  const error = new Error('Fallo ficticio del proveedor');
  const configure = configureFactory({
    tariffRepository: new PgTariffRepository(pool),
    frequencyQueryPort: {
      findWithStops: async () => {
        throw error;
      },
    },
  });
  await expect(configure({ ...fixture, modifiedBy: fixture.adminId, body: body() })).rejects.toBe(
    error,
  );
  expect((await row()).tariff_revision).toBe(0);
  expect((await admin.request(path(), 'PUT', body())).status).toBe(200);
});

test('la actualización de publicación serializa con la configuración de tarifario', async () => {
  const blocker = await pool.connect();
  try {
    await blocker.query('BEGIN');
    await blocker.query("UPDATE route_sheets SET status='PUBLISHED' WHERE id=$1", [
      fixture.routeSheetId,
    ]);
    const response = admin.request(path(), 'PUT', body());
    await blocker.query('COMMIT');
    expect((await response).status).toBe(409);
    expect((await row()).tariff_revision).toBe(0);
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
  }
});

test('la política persiste ceros explícitos, 100 % y dos decimales porcentuales', async () => {
  const value = body();
  value.policy.vipSurchargeBps = 10000;
  value.policy.minorDiscountBps = 0;
  value.policy.seniorDiscountBps = 125;
  expect((await admin.request(path(), 'PUT', value)).status).toBe(200);
  expect((await row()).tariff_draft.policy).toMatchObject({
    vipSurchargeBps: 10000,
    minorDiscountBps: 0,
    seniorDiscountBps: 125,
    discountStrategy: 'MAX_ELIGIBLE',
  });
});
