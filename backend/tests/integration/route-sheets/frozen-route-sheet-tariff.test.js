const http = require('node:http');
const { randomUUID } = require('node:crypto');
const createApp = require('../../../src/app');
const { createAuthModule } = require('../../../src/modules/auth');
const { createFrequenciesModule } = require('../../../src/modules/frequencies');
const { createRouteSheetsModule } = require('../../../src/modules/route-sheets');
const { createHasher } = require('../../../src/modules/auth/infrastructure/password-hasher');
const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const PgTariffRepository = require('../../../src/modules/route-sheets/infrastructure/repositories/pg-route-sheet-tariff-repository');
const publishFactory = require('../../../src/modules/route-sheets/application/use-cases/publish-route-sheet.use-case');

const PASSWORD = 'congelacion solo pruebas 2026';
let pool, server, url, hash, browser, data, routeSheets, frequencyQueries;

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
      const split = part.indexOf('=');
      this.cookies.set(part.slice(0, split), part.slice(split + 1));
    }
    return response;
  }
  async token() {
    this.csrf = (await (await this.request('/api/v1/auth/csrf')).json()).csrfToken;
  }
  async login(email) {
    await this.token();
    expect(
      (await this.request('/api/v1/auth/login', 'POST', { email, password: PASSWORD })).status,
    ).toBe(200);
    await this.token();
  }
}

async function fixtures(name, email) {
  const coop = (
    await pool.query('INSERT INTO cooperatives(name,ruc) VALUES($1,$2) RETURNING id', [
      name,
      randomUUID().replace(/\D/g, '').slice(0, 13).padEnd(13, '2'),
    ])
  ).rows[0].id;
  const user = (
    await pool.query(
      "INSERT INTO users(email,password_hash,role,cooperative_id) VALUES($1,$2,'COOPERATIVE_ADMIN',$3) RETURNING id",
      [email, hash, coop],
    )
  ).rows[0].id;
  const group = (
    await pool.query(
      "INSERT INTO bus_groups(cooperative_id,name,category) VALUES($1,$2,'LONG_ROUTE') RETURNING id",
      [coop, name],
    )
  ).rows[0].id;
  const frequency = (
    await pool.query(
      `INSERT INTO frequencies(cooperative_id,origin,destination,departure_time,ant_resolution_number)
    VALUES($1,'Ambato','Quito','07:00','ANT-FICTICIA') RETURNING id`,
      [coop],
    )
  ).rows[0].id;
  await pool.query(
    "INSERT INTO frequency_stops(frequency_id,position,place) VALUES($1,1,'Latacunga')",
    [frequency],
  );
  const sheet = (
    await pool.query(
      "INSERT INTO route_sheets(cooperative_id,bus_group_id,route_date) VALUES($1,$2,'2026-11-02') RETURNING id",
      [coop, group],
    )
  ).rows[0].id;
  await pool.query(
    `INSERT INTO route_sheet_assignments(route_sheet_id,cooperative_id,bus_group_id,bus_id,frequency_id)
    VALUES($1,$2,$3,$4,$5)`,
    [sheet, coop, group, randomUUID(), frequency],
  );
  return { coop, user, group, frequency, sheet };
}

function draft(expectedRevision = 0) {
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
        frequencyId: data.frequency,
        prices: [
          { fromPosition: 0, toPosition: 1, amountCents: 200 },
          { fromPosition: 0, toPosition: 2, amountCents: 450 },
          { fromPosition: 1, toPosition: 2, amountCents: 300 },
        ],
      },
    ],
  };
}
const path = (operation) => `/api/v1/route-sheets/${data.sheet}/${operation}`;
const row = async () =>
  (await pool.query('SELECT * FROM route_sheets WHERE id=$1', [data.sheet])).rows[0];
const publish = (expectedRevision = 1) =>
  browser.request(path('publish'), 'POST', { expectedRevision });
const context = () => ({
  routeSheetId: data.sheet,
  cooperativeId: data.coop,
  publishedBy: data.user,
});
const priceInput = () => ({
  routeSheetId: data.sheet,
  cooperativeId: data.coop,
  frequencyId: data.frequency,
  fromPosition: 0,
  toPosition: 2,
});

beforeAll(async () => {
  runMigration();
  pool = testPool();
  hash = await (await createHasher()).hash(PASSWORD);
  const auth = await createAuthModule({
    pool,
    env: { JWT_SECRET: 'frozen-tariff-only-test-secret-123456789012345' },
  });
  const frequencies = createFrequenciesModule({ pool, auth });
  frequencyQueries = frequencies.frequencyQueries;
  routeSheets = createRouteSheetsModule({
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
    'TRUNCATE route_sheets, bus_groups, users, auth_sessions, frequencies, cooperatives CASCADE',
  );
  data = await fixtures('Ficticia congelacion', 'frozen-admin@example.ec');
  browser = new Browser();
  await browser.login('frozen-admin@example.ec');
  expect((await browser.request(path('tariff'), 'PUT', draft())).status).toBe(200);
});

afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) await pool.end();
});

test('publica con copia de precios y política conservando la respuesta HTTP', async () => {
  const response = await publish();
  expect(response.status).toBe(200);
  expect((await response.json()).routeSheet.status).toBe('PUBLISHED');
  const saved = await row();
  expect(saved.tariff_frozen).toEqual(saved.tariff_draft);
  expect(saved.tariff_frozen_revision).toBe(1);
  expect(saved.tariff_frozen_by).toBe(data.user);
  expect(saved.published_at).toEqual(saved.tariff_frozen_at);
  expect((await routeSheets.tariffQueries.findPrice(priceInput())).amountCents).toBe(450);
});

test('no expone borradores, hojas ajenas o pares ausentes como tarifas gratuitas', async () => {
  expect(
    await routeSheets.tariffQueries.findPublishedByRouteSheetId(data.sheet, data.coop),
  ).toBeNull();
  expect(await routeSheets.tariffQueries.findPrice(priceInput())).toBeNull();
  expect((await publish()).status).toBe(200);
  expect(
    await routeSheets.tariffQueries.findPublishedByRouteSheetId(data.sheet, randomUUID()),
  ).toBeNull();
  expect(await routeSheets.tariffQueries.findPrice({ ...priceInput(), toPosition: 10 })).toBeNull();
});

test('reintentos y publicaciones simultáneas conservan snapshot, actor y fecha', async () => {
  const responses = await Promise.all([publish(), publish()]);
  expect(responses.map(({ status }) => status)).toEqual([200, 200]);
  const before = await row();
  expect((await publish()).status).toBe(200);
  const after = await row();
  expect(after.tariff_frozen).toEqual(before.tariff_frozen);
  expect(after.tariff_frozen_at).toEqual(before.tariff_frozen_at);
  expect(after.published_at).toEqual(before.published_at);
  expect(after.tariff_revision).toBe(1);
});

test('hoja sin tarifario no se publica y permanece sin copia parcial', async () => {
  await pool.query(
    'UPDATE route_sheets SET tariff_draft=NULL,tariff_revision=0,tariff_updated_by=NULL,tariff_updated_at=NULL WHERE id=$1',
    [data.sheet],
  );
  const response = await browser.request(path('publish'), 'POST', {});
  expect(response.status).toBe(409);
  expect((await response.json()).error.code).toBe('ROUTE_TARIFF_REQUIRED');
  expect((await row()).status).toBe('DRAFT');
  expect((await row()).tariff_frozen).toBeNull();
});

test.each(['inactive', 'assignment', 'route'])(
  'cambio posterior de %s requiere corregir borrador',
  async (change) => {
    if (change === 'inactive')
      await pool.query("UPDATE frequencies SET status='INACTIVE' WHERE id=$1", [data.frequency]);
    if (change === 'assignment')
      await pool.query('DELETE FROM route_sheet_assignments WHERE route_sheet_id=$1', [data.sheet]);
    if (change === 'route')
      await pool.query("UPDATE frequency_stops SET place='Riobamba' WHERE frequency_id=$1", [
        data.frequency,
      ]);
    expect((await publish()).status).toBe(409);
    const saved = await row();
    expect(saved.status).toBe('DRAFT');
    expect(saved.tariff_frozen).toBeNull();
  },
);

test('una actualización de borrador y publicación simultáneas no mezclan revisiones', async () => {
  const changed = draft(1);
  changed.frequencies[0].prices[1].amountCents = 475;
  const responses = await Promise.all([
    publish(1),
    browser.request(path('tariff'), 'PUT', changed),
  ]);
  expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
  const saved = await row();
  if (saved.status === 'PUBLISHED') {
    expect(saved.tariff_frozen_revision).toBe(1);
    expect(saved.tariff_frozen.frequencies[0].prices[1].amountCents).toBe(450);
  } else {
    expect(saved.tariff_revision).toBe(2);
    expect(saved.tariff_frozen).toBeNull();
  }
});

test('rollback después de congelar revierte también el estado publicado', async () => {
  const repository = new PgTariffRepository(pool, {
    frequencySessionFactory: frequencyQueries.forTransaction,
  });
  const failure = new Error('Rollback ficticio después del UPDATE');
  const previous = await row();
  await expect(
    repository.withLockedSheet(
      { routeSheetId: data.sheet, cooperativeId: data.coop, modifiedBy: data.user },
      async ({ freeze }) => {
        await freeze(previous.tariff_draft);
        throw failure;
      },
    ),
  ).rejects.toBe(failure);
  const saved = await row();
  expect(saved.status).toBe('DRAFT');
  expect(saved.tariff_frozen).toBeNull();
  expect((await publish()).status).toBe(200);
});

test('el snapshot no cambia si cambian fuentes, borrador SQL u otra hoja', async () => {
  expect((await publish()).status).toBe(200);
  const before = await routeSheets.tariffQueries.findPublishedByRouteSheetId(data.sheet, data.coop);
  await pool.query("UPDATE frequency_stops SET place='Otra parada' WHERE frequency_id=$1", [
    data.frequency,
  ]);
  await pool.query(
    "UPDATE route_sheets SET tariff_draft=jsonb_set(tariff_draft,'{policy,vipSurchargeBps}','0') WHERE id=$1",
    [data.sheet],
  );
  await fixtures('Otra ficticia', 'frozen-other@example.ec');
  expect(
    await routeSheets.tariffQueries.findPublishedByRouteSheetId(data.sheet, data.coop),
  ).toEqual(before);
  expect((await browser.request(path('tariff'), 'PUT', draft(1))).status).toBe(409);
});

test('la BD impide reemplazar o borrar la copia congelada', async () => {
  expect((await publish()).status).toBe(200);
  await expect(
    pool.query("UPDATE route_sheets SET tariff_frozen='{}'::jsonb WHERE id=$1", [data.sheet]),
  ).rejects.toMatchObject({ code: '23514' });
  await expect(
    pool.query(
      'UPDATE route_sheets SET tariff_frozen=NULL,tariff_frozen_revision=NULL,tariff_frozen_at=NULL,tariff_frozen_by=NULL WHERE id=$1',
      [data.sheet],
    ),
  ).rejects.toMatchObject({ code: '23514' });
  expect((await routeSheets.tariffQueries.findPrice(priceInput())).amountCents).toBe(450);
});

test('la lectura propaga fallos técnicos y no presenta null como si no existiera', async () => {
  expect((await publish()).status).toBe(200);
  const repository = new PgTariffRepository({
    query: async () => {
      throw new Error('Fallo ficticio de conexión');
    },
  });
  await expect(repository.findPublishedById(data.sheet, data.coop)).rejects.toThrow(
    'Fallo ficticio de conexión',
  );
});

test('publicación exige sesión, rol de administrador, CSRF y pertenencia', async () => {
  await pool.query(
    "INSERT INTO users(email,password_hash,role,cooperative_id) VALUES('frozen-clerk@example.ec',$1,'CLERK',$2)",
    [hash, data.coop],
  );
  const clerk = new Browser();
  await clerk.login('frozen-clerk@example.ec');
  expect((await clerk.request(path('publish'), 'POST', {})).status).toBe(403);
  const foreign = await fixtures('Otra autorizacion', 'frozen-other@example.ec');
  const other = new Browser();
  await other.login('frozen-other@example.ec');
  expect((await other.request(path('publish'), 'POST', {})).status).toBe(404);
  expect((await new Browser().request(path('publish'), 'POST', {})).status).toBe(401);
  expect((await browser.request(path('publish'), 'POST', {}, 'incorrecto')).status).toBe(403);
  expect(
    await routeSheets.tariffQueries.findPublishedByRouteSheetId(data.sheet, foreign.coop),
  ).toBeNull();
});

test('la frecuencia permanece bloqueada hasta que termina la publicación', async () => {
  let resume, signal;
  const gate = new Promise((resolve) => {
    resume = resolve;
  });
  const acquired = new Promise((resolve) => {
    signal = resolve;
  });
  const factory = (executor) => {
    const scoped = frequencyQueries.forTransaction(executor);
    return {
      async findWithStops(id, cooperativeId) {
        const detail = await scoped.findWithStops(id, cooperativeId);
        signal();
        await gate;
        return detail;
      },
    };
  };
  const publishing = publishFactory({
    tariffRepository: new PgTariffRepository(pool, { frequencySessionFactory: factory }),
  })(context());
  const client = await pool.connect();
  try {
    await acquired;
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='100ms'");
    await expect(
      client.query("UPDATE frequencies SET status='INACTIVE' WHERE id=$1", [data.frequency]),
    ).rejects.toMatchObject({ code: '55P03' });
    await client.query('ROLLBACK');
    resume();
    await expect(publishing).resolves.toMatchObject({ status: 'PUBLISHED' });
  } finally {
    resume();
    await client.query('ROLLBACK');
    client.release();
    await publishing.catch(() => {});
  }
});
