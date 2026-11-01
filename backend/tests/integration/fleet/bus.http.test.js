const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { start } = require('../../../src/server');
const LocalBusPhotoStorage = require('../../../src/modules/fleet/infrastructure/local-bus-photo-storage');
const { createHasher } = require('../../../src/modules/auth/infrastructure/password-hasher');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { runMigration } = require('../../helpers/database');
const { fleetFixtures, busRequest } = require('../../helpers/fleet-bus');
const { multipart, parts, image, sizedPng, contentType } = require('../../helpers/fleet-upload');

let root, pool, server, url, hash, fixtures, png, signals;
const PASSWORD = 'contraseña ficticia alta Fleet';
class Browser {
  constructor() {
    this.cookies = new Map();
    this.csrf = '';
  }
  headers() {
    return {
      cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      'X-CSRF-Token': this.csrf,
    };
  }
  async request(endpoint, options = {}) {
    const response = await fetch(url + endpoint, {
      ...options,
      headers: { ...this.headers(), ...options.headers },
    });
    for (const value of response.headers.getSetCookie()) {
      const [name, ...rest] = value.split(';')[0].split('=');
      this.cookies.set(name, rest.join('='));
    }
    return response;
  }
  async token() {
    this.csrf = (await (await this.request('/api/v1/auth/csrf')).json()).csrfToken;
  }
  async signIn(role = 'COOPERATIVE_ADMIN') {
    await this.token();
    const response = await this.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `${role.toLowerCase()}@example.ec`, password: PASSWORD }),
    });
    expect(response.status).toBe(200);
    await this.token();
  }
  upload(data, photos = [parts({}, png)[1]]) {
    return this.request('/api/v1/buses', {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: multipart([{ name: 'data', value: JSON.stringify(data) }, ...photos]),
    });
  }
}

beforeAll(async () => {
  runMigration();
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'fleet-http-test-'));
  png = await image();
  hash = await (await createHasher()).hash(PASSWORD);
  signals = new Map(['SIGINT', 'SIGTERM'].map((signal) => [signal, process.listeners(signal)]));
  const listener = http.createServer();
  await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  const running = await start({
    NODE_ENV: 'test',
    DATABASE_URL: assertTestDatabase(),
    JWT_SECRET: 'test-only-fleet-http-secret-123456789012345',
    PORT: String(port),
    BUS_PHOTO_STORAGE_DIR: root,
  });
  pool = running.pool;
  server = running.server;
  url = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE auth_sessions, users, bus_photos, bus_seats, buses, bus_groups, cooperatives CASCADE',
  );
  fixtures = await fleetFixtures(pool);
  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(root);
  for (const role of ['COOPERATIVE_ADMIN', 'CLERK', 'CUSTOMER', 'SYSTEM_ADMIN']) {
    await pool.query(
      'INSERT INTO users(email,password_hash,role,cooperative_id) VALUES($1,$2,$3,$4)',
      [
        `${role.toLowerCase()}@example.ec`,
        hash,
        role,
        ['COOPERATIVE_ADMIN', 'CLERK'].includes(role) ? fixtures.first.cooperativeId : null,
      ],
    );
  }
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) await pool.end();
  if (root) await fs.rm(root, { recursive: true, force: true });
  if (signals)
    for (const [signal, previous] of signals)
      for (const listener of process.listeners(signal))
        if (!previous.includes(listener)) process.removeListener(signal, listener);
});
const data = () => busRequest(fixtures.first).data;
async function assertEmpty() {
  for (const table of ['buses', 'bus_seats', 'bus_photos'])
    expect((await pool.query(`SELECT id FROM ${table}`)).rows).toEqual([]);
  expect(await fs.readdir(root)).toEqual([]);
}

test('arranque real registra bus con fotos privadas e identidades de asientos completas', async () => {
  const browser = new Browser();
  await browser.signIn();
  const response = await browser.upload(data());
  expect(response.status).toBe(201);
  const { bus } = await response.json();
  expect(bus).toMatchObject({ plate: 'TBM-0013', vin: 'VIN0013', unitNumber: 1, capacity: 42 });
  expect(bus.photos).toHaveLength(1);
  expect(Object.keys(bus.photos[0]).sort()).toEqual(['contentType', 'id', 'order', 'size']);
  expect(JSON.stringify(bus)).not.toContain(root);
  expect(bus.cooperative_id).toBeUndefined();
  const stored = (
    await pool.query('SELECT * FROM bus_photos WHERE bus_id=$1 AND cooperative_id=$2', [
      bus.id,
      fixtures.first.cooperativeId,
    ])
  ).rows[0];
  expect(await fs.readFile(path.join(root, 'buses', bus.id, 'photos', stored.storage_key))).toEqual(
    png,
  );
  expect(
    (
      await pool.query('SELECT id FROM bus_seats WHERE bus_id=$1 AND cooperative_id=$2', [
        bus.id,
        fixtures.first.cooperativeId,
      ])
    ).rows,
  ).toHaveLength(42);
  expect((await browser.request(`/buses/${bus.id}/photos/${stored.storage_key}`)).status).toBe(404);
});

test('acepta diez imágenes y conserva su orden', async () => {
  const browser = new Browser();
  await browser.signIn();
  const response = await browser.upload(
    data(),
    Array.from({ length: 10 }, () => parts({}, png)[1]),
  );
  expect(response.status).toBe(201);
  expect((await response.json()).bus.photos.map((photo) => photo.order)).toEqual([
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
  ]);
});

test.each([
  ['anonymous', 401],
  ['CLERK', 403],
  ['CUSTOMER', 403],
  ['SYSTEM_ADMIN', 403],
  ['csrf', 403],
])('rechaza %s antes de esperar el cuerpo multipart', async (role, status) => {
  const browser = new Browser();
  if (role !== 'anonymous') await browser.signIn(role === 'csrf' ? 'COOPERATIVE_ADMIN' : role);
  if (role === 'csrf') browser.csrf = 'inválido';
  const prepare = jest.spyOn(LocalBusPhotoStorage.prototype, 'prepare');
  const response = await new Promise((resolve, reject) => {
    const request = http.request(
      url + '/api/v1/buses',
      {
        method: 'POST',
        headers: { ...browser.headers(), 'Content-Type': contentType, 'Content-Length': 1000000 },
      },
      (res) => {
        res.resume();
        res.once('end', () => {
          request.destroy();
          resolve(res);
        });
      },
    );
    request.once('error', reject);
    request.flushHeaders(); // No enviar ni terminar el cuerpo: la autorización debe responder primero.
  });
  expect(response.statusCode).toBe(status);
  expect(prepare).not.toHaveBeenCalled();
  await assertEmpty();
});

test.each(['other', 'missing'])(
  'grupo %s responde el mismo 404 sin filas ni fotos',
  async (kind) => {
    const browser = new Browser();
    await browser.signIn();
    const response = await browser.upload({
      ...data(),
      busGroupId: kind === 'other' ? fixtures.second.busGroupId : randomUUID(),
    });
    expect(response.status).toBe(404);
    expect((await response.json()).error).toEqual({
      code: 'BUS_GROUP_NOT_FOUND',
      message: 'El grupo de buses no está disponible.',
    });
    expect((await pool.query('SELECT id FROM buses')).rows).toEqual([]);
    expect(await fs.readdir(path.join(root, '.staging'))).toEqual([]);
    expect(await fs.readdir(path.join(root, 'buses'))).toEqual([]);
  },
);

test.each(['plate', 'vin', 'unitNumber'])(
  'duplicado %s responde 409 sin alterar archivos previos',
  async (field) => {
    const browser = new Browser();
    await browser.signIn();
    const first = await (await browser.upload(data())).json();
    const next = {
      ...data(),
      plate: 'TBM-0099',
      vin: 'OTRO',
      unitNumber: 99,
      [field]: data()[field],
    };
    const response = await browser.upload(next);
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe('BUS_ALREADY_EXISTS');
    expect(await fs.readdir(path.join(root, 'buses'))).toEqual([first.bus.id]);
    expect(await fs.readdir(path.join(root, '.staging'))).toEqual([]);
  },
);

test.each(['extra', 'unknown-layout', 'all-disabled', 'bad-plate'])(
  'rechaza metadata %s antes de preparar archivos',
  async (kind) => {
    const browser = new Browser();
    await browser.signIn();
    const input = data();
    if (kind === 'extra') input.cooperative_id = fixtures.second.cooperativeId;
    if (kind === 'unknown-layout') input.seatLayoutVersion = 999;
    if (kind === 'bad-plate') input.plate = 'TBM-123';
    if (kind === 'all-disabled')
      input.disabledSeatKeys = busRequest(fixtures.first).configuration.seats.map(
        (seat) => seat.layoutSeatKey,
      );
    const response = await browser.upload(input);
    expect(response.status).toBe(400);
    await assertEmpty();
  },
);

test.each([
  'false',
  'truncated',
  'extension',
  'mime',
  'eleven',
  'empty',
  'large',
  'duplicate-data',
])('rechaza carga %s sin archivos ni SQL', async (kind) => {
  const browser = new Browser();
  await browser.signIn();
  const photo = { ...parts({}, png)[1] };
  if (kind === 'false') photo.value = Buffer.from('no es una foto');
  if (kind === 'truncated') photo.value = png.subarray(0, png.length / 2);
  if (kind === 'extension') photo.filename = 'foto.exe';
  if (kind === 'mime') photo.contentType = 'image/jpeg';
  if (kind === 'large') photo.value = Buffer.alloc(5_000_001);
  let photos =
    kind === 'eleven' ? Array.from({ length: 11 }, () => photo) : kind === 'empty' ? [] : [photo];
  if (kind === 'duplicate-data') photos.push({ name: 'data', value: '{}' });
  const response = await browser.upload(data(), photos);
  expect(response.status).toBe(kind === 'large' ? 413 : 400);
  await assertEmpty();
});

test('acepta imagen real de exactamente 5MB', async () => {
  const browser = new Browser();
  await browser.signIn();
  const bytes = sizedPng(png, 5_000_000);
  const response = await browser.upload(data(), [{ ...parts({}, bytes)[1] }]);
  expect(response.status).toBe(201);
  expect((await response.json()).bus.photos[0].size).toBe(5_000_000);
});

test('carga interrumpida no prepara archivos ni persiste filas', async () => {
  const browser = new Browser();
  await browser.signIn();
  const request = http.request(url + '/api/v1/buses', {
    method: 'POST',
    headers: { ...browser.headers(), 'Content-Type': contentType },
  });
  request.on('error', () => {});
  request.write(multipart(parts(data(), png)).subarray(0, 100));
  await delay(30);
  request.destroy();
  await delay(30);
  await assertEmpty();
});

test('tipo no multipart responde 415 con formato de error estándar', async () => {
  const browser = new Browser();
  await browser.signIn();
  const response = await browser.request('/api/v1/buses', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'invalid',
  });
  expect(response.status).toBe(415);
  expect((await response.json()).error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  await assertEmpty();
});

test('JSON malformado se rechaza por tipo después de autenticación, sin usar parser global', async () => {
  const browser = new Browser();
  await browser.signIn();
  const response = await browser.request('/api/v1/buses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  expect(response.status).toBe(415);
  const anonymous = await new Browser().request('/api/v1/buses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  expect(anonymous.status).toBe(401);
  await assertEmpty();
});

test('fallo técnico de disco responde 500 genérico sin ruta, stack ni detalles privados', async () => {
  const browser = new Browser();
  await browser.signIn();
  jest
    .spyOn(LocalBusPhotoStorage.prototype, 'prepare')
    .mockRejectedValue(new Error(`ruta privada ${root}`));
  const response = await browser.upload(data());
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor.' },
  });
  await assertEmpty();
});
