const http = require('node:http');
const { randomUUID } = require('node:crypto');
const os = require('node:os');
const createApp = require('../../../src/app');
const { createFleetModule } = require('../../../src/modules/fleet');
const { createRouteSheetsModule } = require('../../../src/modules/route-sheets');
const { createAuthModule } = require('../../../src/modules/auth');
const { createHasher } = require('../../../src/modules/auth/infrastructure/password-hasher');
const PgBusRepository = require('../../../src/modules/fleet/infrastructure/pg-bus.repository');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { runMigration, testPool } = require('../../helpers/database');
const { busRequest, fleetFixtures } = require('../../helpers/fleet-bus');

const PASSWORD = 'contraseña ficticia conexión buses';
let pool,
  server,
  url,
  hash,
  fixtures,
  ownBus,
  otherGroupBus,
  foreignBus,
  sheetId,
  frequencyId,
  browser;
class Browser {
  constructor() {
    this.cookies = new Map();
    this.csrf = '';
  }
  async request(endpoint, body) {
    const response = await fetch(url + endpoint, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.csrf,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const value of response.headers.getSetCookie()) {
      const first = value.split(';')[0];
      const separator = first.indexOf('=');
      this.cookies.set(first.slice(0, separator), first.slice(separator + 1));
    }
    return response;
  }
  async signIn() {
    this.csrf = (await (await this.request('/api/v1/auth/csrf')).json()).csrfToken;
    expect(
      (
        await this.request('/api/v1/auth/login', {
          email: 'fleet-sheet@example.ec',
          password: PASSWORD,
        })
      ).status,
    ).toBe(200);
    this.csrf = (await (await this.request('/api/v1/auth/csrf')).json()).csrfToken;
  }
}

beforeAll(async () => {
  runMigration();
  pool = testPool();
  hash = await (await createHasher()).hash(PASSWORD);
  const auth = await createAuthModule({
    pool,
    env: { JWT_SECRET: 'test-only-fleet-route-secret-123456789012345' },
  });
  const fleet = createFleetModule({ pool, auth, env: { BUS_PHOTO_STORAGE_DIR: os.tmpdir() } });
  // Contrato de frecuencias fuera de FLEET-04. Solo este proveedor usa un doble.
  const frequencyQueries = {
    findById: async (id, cooperativeId) =>
      id === frequencyId && cooperativeId === fixtures.first.cooperativeId
        ? { id, status: 'ACTIVE' }
        : null,
    findActiveByCooperativeId: async () => [{ id: frequencyId, status: 'ACTIVE' }],
  };
  const routeSheets = createRouteSheetsModule({
    pool,
    auth,
    frequencyQueries,
    busGroupQueries: fleet.busGroupQueries,
    busQueries: fleet.busQueries,
  });
  server = http.createServer(createApp({ auth, fleet, routeSheets, pool }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE route_sheets, bus_photos, bus_seats, buses, bus_groups, users, cooperatives CASCADE',
  );
  fixtures = await fleetFixtures(pool);
  await pool.query(
    "INSERT INTO users(email,password_hash,role,cooperative_id) VALUES('fleet-sheet@example.ec',$1,'COOPERATIVE_ADMIN',$2)",
    [hash, fixtures.first.cooperativeId],
  );
  const otherGroup = (
    await pool.query(
      "INSERT INTO bus_groups(cooperative_id,name,category) VALUES($1,'Otro grupo','LONG_ROUTE') RETURNING id",
      [fixtures.first.cooperativeId],
    )
  ).rows[0].id;
  const repository = new PgBusRepository(pool);
  ownBus = await repository.create(busRequest(fixtures.first));
  otherGroupBus = await repository.create(
    busRequest({
      ...fixtures.first,
      busGroupId: otherGroup,
      data: { plate: 'TBM-0099', vin: 'VIN0099', unitNumber: 2 },
    }),
  );
  foreignBus = await repository.create(
    busRequest({ ...fixtures.second, data: { plate: 'XYZ-0001', vin: 'FOREIGN', unitNumber: 1 } }),
  );
  frequencyId = randomUUID();
  browser = new Browser();
  await browser.signIn();
  const created = await browser.request('/api/v1/route-sheets', {
    busGroupId: fixtures.first.busGroupId,
    routeDate: '2026-11-03',
  });
  expect(created.status).toBe(201);
  sheetId = (await created.json()).routeSheet.id;
});
afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) await pool.end();
});

describe.each([
  ['assignments', 'route_sheet_assignments'],
  ['rest-days', 'route_sheet_rest_days'],
])('%s con Fleet real', (endpoint, table) => {
  async function send(busId, extra = {}) {
    return browser.request(`/api/v1/route-sheets/${sheetId}/${endpoint}`, {
      busId,
      frequencyId,
      reason: 'Parada de prueba',
      ...extra,
    });
  }
  test('grupo diferente responde 409 y no guarda filas', async () => {
    const response = await send(otherGroupBus.id);
    expect(response.status).toBe(409);
    expect((await response.json()).error).toEqual({
      code: 'BUS_NOT_IN_ROUTE_SHEET_GROUP',
      message: 'El bus no pertenece al grupo de la hoja de ruta.',
    });
    expect(
      (await pool.query(`SELECT * FROM ${table} WHERE route_sheet_id=$1`, [sheetId])).rows,
    ).toEqual([]);
  });
  test.each(['foreign', 'missing', 'invalid'])(
    'bus %s responde 403 sin escrituras',
    async (kind) => {
      const response = await send(
        kind === 'foreign' ? foreignBus.id : kind === 'missing' ? randomUUID() : 'no-es-uuid',
      );
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe('BUS_NOT_FROM_COOPERATIVE');
      expect((await pool.query(`SELECT * FROM ${table}`)).rows).toEqual([]);
    },
  );
  test('mismo grupo guarda el bus y la cooperativa reales', async () => {
    const response = await send(ownBus.id);
    expect(response.status).toBe(200);
    const rows = (
      await pool.query(`SELECT * FROM ${table} WHERE route_sheet_id=$1 AND cooperative_id=$2`, [
        sheetId,
        fixtures.first.cooperativeId,
      ])
    ).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ bus_id: ownBus.id, bus_group_id: fixtures.first.busGroupId });
  });
  test('cooperativa en body no permite consultar el bus ajeno', async () => {
    const response = await send(foreignBus.id, {
      cooperativeId: fixtures.second.cooperativeId,
      cooperative_id: fixtures.second.cooperativeId,
    });
    expect(response.status).toBe(403);
    expect((await pool.query(`SELECT * FROM ${table}`)).rows).toEqual([]);
  });
});
