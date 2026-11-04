const http = require('node:http');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const createApp = require('../../../src/app');
const { start } = require('../../../src/server');
const { createAuthModule } = require('../../../src/modules/auth');
const { createBookingsModule } = require('../../../src/modules/bookings');
const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const {
  summaryInput,
  summaryContext,
} = require('../../unit/bookings/helpers/booking-summary-fixtures');

const env = {
  JWT_SECRET: 'secreto-ficticio-solo-para-pruebas-http-123456',
  JWT_EXPIRES_IN: '30m',
  BOOKING_PROOF_WINDOW_SECONDS: '180',
};
const key = '00000000-0000-4000-8000-000000000001';
let pool;
let auth;
let server;
let url;
let userId;
let sid;
let tripCatalog;
let passengerVerifier;
let newId;

class Browser {
  constructor(baseUrl = url, token) {
    this.url = baseUrl;
    this.cookies = new Map(token ? [['access_token', token]] : []);
    this.csrf = '';
  }
  async request(path, method = 'GET', body, extra = {}) {
    const headers = {
      cookie: [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; '),
      ...(method === 'GET'
        ? {}
        : { 'Content-Type': 'application/json', 'X-CSRF-Token': this.csrf }),
      ...extra,
    };
    const response = await fetch(this.url + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const part = cookie.split(';')[0];
      const position = part.indexOf('=');
      this.cookies.set(part.slice(0, position), part.slice(position + 1));
    }
    return response;
  }
  async token() {
    const response = await this.request('/api/v1/auth/csrf');
    this.csrf = (await response.json()).csrfToken;
  }
}

function accessToken(id = userId, sessionId = sid, role = 'CUSTOMER') {
  return jwt.sign({ sub: id, sid: sessionId, role, cooperative_id: null }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '30m',
  });
}
async function customer(baseUrl = url) {
  const browser = new Browser(baseUrl, accessToken());
  await browser.token();
  return browser;
}
async function listen(app) {
  const instance = http.createServer(app);
  await new Promise((resolve) => instance.listen(0, '127.0.0.1', resolve));
  return { server: instance, url: `http://127.0.0.1:${instance.address().port}` };
}
async function close(instance) {
  await new Promise((resolve, reject) =>
    instance.close((error) => (error ? reject(error) : resolve())),
  );
}
async function alternate(options, execute) {
  const mounted = await listen(
    createApp({ auth, pool, bookings: createBookingsModule({ auth, pool, env, ...options }) }),
  );
  try {
    return await execute(mounted.url);
  } finally {
    await close(mounted.server);
  }
}
async function accepted(browser) {
  const input = summaryInput();
  const response = await browser.request('/api/v1/bookings/summary', 'POST', input);
  expect(response.status).toBe(200);
  return {
    ...input,
    summaryAccepted: true,
    acceptedSummaryRevision: (await response.json()).summaryRevision,
  };
}
async function counts() {
  const { rows } = await pool.query(`SELECT (SELECT count(*)::int FROM bookings) AS bookings,
    (SELECT count(*)::int FROM booking_seat_allocations) AS allocations`);
  return rows[0];
}
const createHeaders = { 'Idempotency-Key': key };

beforeAll(async () => {
  runMigration();
  pool = testPool();
  auth = await createAuthModule({ pool, env });
  tripCatalog = { findBookableById: jest.fn() };
  passengerVerifier = { verify: jest.fn() };
  newId = jest.fn(randomUUID);
  const bookings = createBookingsModule({
    pool,
    auth,
    env,
    tripCatalog,
    passengerVerifier,
    newId,
    clock: () => new Date('2026-10-27T15:00:00Z'),
  });
  const mounted = await listen(createApp({ auth, bookings, pool }));
  server = mounted.server;
  url = mounted.url;
});
beforeEach(async () => {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE auth_sessions, users, booking_proof_receipt_results, booking_seat_allocations, bookings, booking_trip_locks',
  );
  userId = randomUUID();
  sid = randomUUID();
  await pool.query(
    `INSERT INTO users (id,email,password_hash,role)
    VALUES ($1,'comprador-ficticio@example.ec','hash-no-utilizado-en-autenticacion-de-sesion','CUSTOMER')`,
    [userId],
  );
  await pool.query(
    `INSERT INTO auth_sessions (id,user_id,expires_at)
    VALUES ($1,$2,CURRENT_TIMESTAMP + interval '1 hour')`,
    [sid, userId],
  );
  const context = summaryContext();
  tripCatalog.findBookableById.mockReset().mockResolvedValue(context.trip);
  passengerVerifier.verify
    .mockReset()
    .mockResolvedValue(
      context.passengerBenefits.map((entry) => ({ ...entry, birthDateVerified: true })),
    );
  newId.mockClear();
});
afterAll(async () => {
  if (server) await close(server);
  if (pool) await pool.end();
});

test('HTTP autenticado consulta disponibilidad, acepta resumen y persiste reserva con plazo configurado', async () => {
  const browser = await customer();
  const availability = await browser.request(
    '/api/v1/bookings/availability?tripId=viaje-prueba&fromPosition=1&toPosition=3',
  );
  expect(availability.status).toBe(200);
  expect(availability.headers.get('cache-control')).toBe('no-store');
  expect(await availability.json()).toEqual({
    seats: [
      { seatId: '02', status: 'AVAILABLE' },
      { seatId: '03', status: 'AVAILABLE' },
      { seatId: '01', status: 'AVAILABLE' },
    ],
  });
  const input = await accepted(browser);
  expect(await counts()).toEqual({ bookings: 0, allocations: 0 });
  const response = await browser.request('/api/v1/bookings', 'POST', input, createHeaders);
  expect(response.status).toBe(201);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const { booking } = await response.json();
  expect(booking).toMatchObject({
    ownerId: userId,
    status: 'PENDING_PAYMENT',
    expiresAt: '2026-10-27T15:03:00.000Z',
    summary: { totals: { totalPriceCents: 752 } },
  });
  expect((await pool.query('SELECT id,owner_id FROM bookings')).rows).toEqual([
    { id: booking.bookingId, owner_id: userId },
  ]);
  expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
});

test('misma cabecera y cuerpo recuperan la reserva aunque catálogo y verificador fallen después', async () => {
  const browser = await customer();
  const input = await accepted(browser);
  const first = await browser.request('/api/v1/bookings', 'POST', input, createHeaders);
  const original = await first.json();
  tripCatalog.findBookableById.mockRejectedValue(new Error('catálogo de prueba caído'));
  passengerVerifier.verify.mockRejectedValue(new Error('verificador de prueba caído'));
  const repeated = await browser.request('/api/v1/bookings', 'POST', input, createHeaders);
  expect(repeated.status).toBe(201);
  expect(await repeated.json()).toEqual(original);
  expect(newId).toHaveBeenCalledTimes(1);
  expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
});

test('segunda clave por los mismos asientos devuelve conflicto sin otra ocupación', async () => {
  const browser = await customer();
  const input = await accepted(browser);
  await browser.request('/api/v1/bookings', 'POST', input, createHeaders);
  const response = await browser.request('/api/v1/bookings', 'POST', input, {
    'Idempotency-Key': randomUUID(),
  });
  expect(response.status).toBe(409);
  expect((await response.json()).error.code).toBe('BOOKING_SEAT_CONFLICT');
  expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
});

test('sesión ausente o revocada no permite leer ni crear y no almacena respuestas privadas', async () => {
  const anonymous = new Browser();
  const unavailable = await anonymous.request('/api/v1/bookings/summary', 'POST', summaryInput());
  expect(unavailable.status).toBe(401);
  expect(unavailable.headers.get('cache-control')).toBe('no-store');
  const browser = await customer();
  await pool.query('UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE id=$1', [sid]);
  const response = await browser.request(
    '/api/v1/bookings/availability?tripId=viaje-prueba&fromPosition=1&toPosition=3',
  );
  expect(response.status).toBe(401);
  expect(await counts()).toEqual({ bookings: 0, allocations: 0 });
});

test('rol SYSTEM_ADMIN no puede comprar en la ruta CUSTOMER', async () => {
  await pool.query("UPDATE users SET role='SYSTEM_ADMIN' WHERE id=$1", [userId]);
  const browser = new Browser(url, accessToken(userId, sid, 'SYSTEM_ADMIN'));
  await browser.token();
  const response = await browser.request('/api/v1/bookings/summary', 'POST', summaryInput());
  expect(response.status).toBe(403);
  expect((await response.json()).error.code).toBe('FORBIDDEN');
});

test.each(['/summary', ''])(
  'CSRF ausente/manipulado bloquea POST %s antes de proveedores',
  async (suffix) => {
    const browser = await customer();
    const input = suffix
      ? summaryInput()
      : { ...summaryInput(), summaryAccepted: true, acceptedSummaryRevision: 'a'.repeat(64) };
    for (const csrf of ['', 'arbitrario']) {
      const response = await browser.request('/api/v1/bookings' + suffix, 'POST', input, {
        ...createHeaders,
        'X-CSRF-Token': csrf,
      });
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe('CSRF_TOKEN_INVALID');
    }
    expect(tripCatalog.findBookableById).not.toHaveBeenCalled();
    expect(await counts()).toEqual({ bookings: 0, allocations: 0 });
  },
);

test.each([undefined, 'no-uuid'])(
  'creación exige clave válida en cabecera: %j',
  async (requestKey) => {
    const browser = await customer();
    const input = await accepted(browser);
    const response = await browser.request(
      '/api/v1/bookings',
      'POST',
      input,
      requestKey === undefined ? {} : { 'Idempotency-Key': requestKey },
    );
    expect(response.status).toBe(400);
    expect(await counts()).toEqual({ bookings: 0, allocations: 0 });
  },
);

test.each(['ownerId', 'cooperativeId', 'totalPriceCents', 'requestKey'])(
  'no ignora ni sobrescribe campo inyectado %s',
  async (field) => {
    const browser = await customer();
    const input = await accepted(browser);
    const response = await browser.request(
      '/api/v1/bookings',
      'POST',
      { ...input, [field]: field === 'requestKey' ? key : 'inyectado' },
      createHeaders,
    );
    expect(response.status).toBe(400);
    expect(await counts()).toEqual({ bookings: 0, allocations: 0 });
  },
);

test('cambio de tarifa responde 409 y exige revisar el resumen sin escribir', async () => {
  const browser = await customer();
  const input = await accepted(browser);
  const trip = summaryContext().trip;
  trip.segmentPricesCents[1] += 100;
  tripCatalog.findBookableById.mockResolvedValue(trip);
  const response = await browser.request('/api/v1/bookings', 'POST', input, createHeaders);
  expect(response.status).toBe(409);
  expect((await response.json()).error.code).toBe('BOOKING_SUMMARY_CHANGED');
  expect(await counts()).toEqual({ bookings: 0, allocations: 0 });
});

test.each([
  'fromPosition=1.5&toPosition=3',
  'fromPosition=1&fromPosition=2&toPosition=3',
  'fromPosition=1&toPosition=3&ownerId=ajeno',
])('consulta rechaza coerción o campos extra: %s', async (query) => {
  const browser = await customer();
  const response = await browser.request(
    '/api/v1/bookings/availability?tripId=viaje-prueba&' + query,
  );
  expect(response.status).toBe(400);
  expect(tripCatalog.findBookableById).not.toHaveBeenCalled();
});

test('viaje inexistente da 404 y un proveedor inesperadamente fallido no expone detalles', async () => {
  const browser = await customer();
  tripCatalog.findBookableById.mockResolvedValueOnce(null);
  const absent = await browser.request('/api/v1/bookings/summary', 'POST', summaryInput());
  expect(absent.status).toBe(404);
  tripCatalog.findBookableById.mockRejectedValue(new Error('detalle-sql-privado-de-prueba'));
  const failed = await browser.request('/api/v1/bookings/summary', 'POST', summaryInput());
  expect(failed.status).toBe(500);
  expect(await failed.json()).toEqual({
    error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor.' },
  });
});

test('POST exige application/json', async () => {
  const browser = await customer();
  const response = await browser.request('/api/v1/bookings/summary', 'POST', summaryInput(), {
    'Content-Type': 'text/plain',
  });
  expect(response.status).toBe(415);
  expect((await response.json()).error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
});

test('sin proveedores responde 503 y permite recuperar la reserva ya creada por su propietario', async () => {
  const browser = await customer();
  const input = await accepted(browser);
  const created = await browser.request('/api/v1/bookings', 'POST', input, createHeaders);
  const original = await created.json();
  await alternate({}, async (baseUrl) => {
    const missing = await customer(baseUrl);
    const unavailable = await missing.request('/api/v1/bookings/summary', 'POST', summaryInput());
    expect(unavailable.status).toBe(503);
    expect((await unavailable.json()).error.code).toBe('BOOKING_TRIP_SERVICE_UNAVAILABLE');
    const recovered = await missing.request('/api/v1/bookings', 'POST', input, createHeaders);
    expect(recovered.status).toBe(201);
    expect(await recovered.json()).toEqual(original);
  });
  expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
});

test('catálogo real sin verificador no acredita pasajeros ni guarda reserva', async () => {
  await alternate(
    { tripCatalog, clock: () => new Date('2026-10-27T15:00:00Z') },
    async (baseUrl) => {
      const browser = await customer(baseUrl);
      const response = await browser.request('/api/v1/bookings/summary', 'POST', summaryInput());
      expect(response.status).toBe(503);
      expect((await response.json()).error.code).toBe('BOOKING_BENEFIT_SERVICE_UNAVAILABLE');
    },
  );
  expect(await counts()).toEqual({ bookings: 0, allocations: 0 });
});

test('arranque real conecta disponibilidad y conserva health sin compras ficticias', async () => {
  const probe = await listen(createApp());
  const port = probe.server.address().port;
  await close(probe.server);
  const running = await start({ ...env, PORT: String(port), DATABASE_URL: assertTestDatabase() });
  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    expect((await fetch(baseUrl + '/api/v1/health')).status).toBe(200);
    const browser = await customer(baseUrl);
    const invalid = await browser.request(
      '/api/v1/bookings/availability?tripId=viaje-prueba&fromPosition=1&toPosition=3',
    );
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error.code).toBe('BOOKING_VALIDATION_ERROR');
    const missing = await browser.request(
      `/api/v1/bookings/availability?tripId=${randomUUID()}&fromPosition=0&toPosition=1`,
    );
    expect(missing.status).toBe(404);
    expect((await missing.json()).error.code).toBe('BOOKING_TRIP_UNAVAILABLE');
    const summary = await browser.request('/api/v1/bookings/summary', 'POST', summaryInput());
    expect(summary.status).toBe(503);
    expect((await summary.json()).error.code).toBe('BOOKING_TRIP_SERVICE_UNAVAILABLE');
    expect(await counts()).toEqual({ bookings: 0, allocations: 0 });
  } finally {
    await running.stop();
  }
});

test('JSON malformado también responde sin caché y sin detalles privados', async () => {
  const browser = await customer();
  const response = await fetch(url + '/api/v1/bookings/summary', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: [...browser.cookies].map(([name, value]) => `${name}=${value}`).join('; '),
      'X-CSRF-Token': browser.csrf,
    },
    body: '{"passengers":',
  });
  expect(response.status).toBe(400);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect((await response.json()).error.code).toBe('INVALID_JSON');
  expect(await counts()).toEqual({ bookings: 0, allocations: 0 });
});

test('misma clave con otro pasajero responde conflicto específico sin otra reserva', async () => {
  const browser = await customer();
  const input = await accepted(browser);
  await browser.request('/api/v1/bookings', 'POST', input, createHeaders);
  input.passengers[0].fullName = 'Otra Pasajera Ficticia';
  const response = await browser.request('/api/v1/bookings', 'POST', input, createHeaders);
  expect(response.status).toBe(409);
  expect((await response.json()).error.code).toBe('BOOKING_REQUEST_KEY_REUSED');
  expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
});

test('beneficio por edad sin acreditar pide revisión y no permite escribir una reserva', async () => {
  const browser = await customer();
  passengerVerifier.verify.mockResolvedValue(
    summaryContext().passengerBenefits.map((entry) => ({ ...entry, birthDateVerified: false })),
  );
  const response = await browser.request('/api/v1/bookings/summary', 'POST', summaryInput());
  expect(response.status).toBe(409);
  expect((await response.json()).error.code).toBe('BOOKING_BENEFIT_REVIEW_REQUIRED');
  expect(await counts()).toEqual({ bookings: 0, allocations: 0 });
});

test('consulta de intento recupera compra propia sin catálogo y mantiene fechas', async () => {
  const browser = await customer();
  const input = await accepted(browser);
  const original = await (
    await browser.request('/api/v1/bookings', 'POST', input, createHeaders)
  ).json();
  tripCatalog.findBookableById.mockRejectedValue(new Error('catálogo no disponible'));
  const response = await browser.request('/api/v1/bookings/attempts/' + key);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toEqual(original);
  expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
});

test('intento de otro comprador y clave desconocida son indistinguibles', async () => {
  const browser = await customer();
  const input = await accepted(browser);
  await browser.request('/api/v1/bookings', 'POST', input, createHeaders);
  const otherUser = randomUUID();
  const otherSession = randomUUID();
  await pool.query(
    `INSERT INTO users (id,email,password_hash,role)
    VALUES ($1,'otro-ficticio@example.ec','hash-de-prueba','CUSTOMER')`,
    [otherUser],
  );
  await pool.query(
    `INSERT INTO auth_sessions (id,user_id,expires_at)
    VALUES ($1,$2,CURRENT_TIMESTAMP + interval '1 hour')`,
    [otherSession, otherUser],
  );
  const other = new Browser(url, accessToken(otherUser, otherSession));
  const foreign = await other.request('/api/v1/bookings/attempts/' + key);
  const absent = await other.request('/api/v1/bookings/attempts/' + randomUUID());
  expect(foreign.status).toBe(404);
  expect(absent.status).toBe(404);
  expect(await foreign.json()).toEqual(await absent.json());
  expect(await counts()).toEqual({ bookings: 1, allocations: 2 });
});

test('consulta de intento rechaza clave inválida, sesión ausente y contexto por query', async () => {
  const anonymous = new Browser();
  expect((await anonymous.request('/api/v1/bookings/attempts/' + key)).status).toBe(401);
  const browser = await customer();
  expect((await browser.request('/api/v1/bookings/attempts/invalido')).status).toBe(400);
  expect(
    (await browser.request('/api/v1/bookings/attempts/' + key + '?ownerId=ajeno')).status,
  ).toBe(400);
  expect(await counts()).toEqual({ bookings: 0, allocations: 0 });
});
