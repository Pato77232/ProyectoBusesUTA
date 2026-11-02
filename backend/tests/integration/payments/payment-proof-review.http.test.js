const http = require('node:http');
const { randomBytes, randomUUID } = require('node:crypto');
const { mkdtemp, rmdir, unlink, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const createApp = require('../../../src/app');
const { createAuthModule } = require('../../../src/modules/auth');
const { createPaymentsModule } = require('../../../src/modules/payments');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { runMigration, testPool } = require('../../helpers/database');

const API = '/api/v1/payment-proofs';
const FILE_CONTENT = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV0cAAAAASUVORK5CYII=',
  'base64',
);
let pool;
let server;
let baseUrl;
let payments;
let cooperativeId;
let otherCooperativeId;
let storageDirectory;
let fileKey;

class Browser {
  constructor() {
    this.cookies = new Map();
    this.csrf = '';
  }

  async request(route, method = 'GET', body, csrf = this.csrf) {
    const headers = {
      cookie: [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; '),
    };
    if (method !== 'GET') {
      headers['Content-Type'] = 'application/json';
      headers['X-CSRF-Token'] = csrf;
    }
    const response = await fetch(baseUrl + route, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0];
      const separator = pair.indexOf('=');
      this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    return response;
  }

  async token() {
    const response = await this.request('/api/v1/auth/csrf');
    expect(response.status).toBe(200);
    this.csrf = (await response.json()).csrfToken;
  }

  approve(proofId, csrf = this.csrf, body = {}) {
    return this.request(`${API}/${proofId}/approve`, 'POST', body, csrf);
  }
}

async function createCooperative() {
  const ruc = randomUUID().replace(/\D/g, '').slice(0, 13).padStart(13, '7');
  const { rows } = await pool.query(
    'INSERT INTO cooperatives(name, ruc) VALUES ($1, $2) RETURNING id',
    ['Cooperativa sintética HTTP Pagos', ruc],
  );
  return rows[0].id;
}

async function signIn(role = 'CLERK', tenantId = cooperativeId) {
  const browser = new Browser();
  const email = `qa-${randomUUID()}@example.ec`;
  const password = randomBytes(24).toString('hex');
  await browser.token();
  const registered = await browser.request('/api/v1/auth/register', 'POST', { email, password });
  expect(registered.status).toBe(201);
  // Solo fixtures en BD de prueba: no presupone un endpoint productivo de alta CLERK.
  const tenant = ['CLERK', 'COOPERATIVE_ADMIN'].includes(role) ? tenantId : null;
  const { rows } = await pool.query(
    'UPDATE users SET role = $1, cooperative_id = $2 WHERE email = $3 RETURNING id',
    [role, tenant, email],
  );
  const login = await browser.request('/api/v1/auth/login', 'POST', { email, password });
  expect(login.status).toBe(200);
  await browser.token();
  return { browser, userId: rows[0].id };
}

async function createProof(tenantId = cooperativeId) {
  const bookingId = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO payment_proofs(
      booking_id, cooperative_id, status, file_key, original_file_name,
      media_type, file_size_bytes, uploaded_at
    ) VALUES ($1, $2, 'UPLOADED', $3, 'comprobante.png', 'image/png', $4, CURRENT_TIMESTAMP)
    RETURNING *`,
    [bookingId, tenantId, fileKey, FILE_CONTENT.length],
  );
  payments.bookingReader.bookings.set(bookingId, {
    bookingId,
    cooperativeId: tenantId,
    total: 875,
  });
  return rows[0];
}

async function persistedProof(proofId) {
  return (await pool.query('SELECT * FROM payment_proofs WHERE id = $1', [proofId])).rows[0];
}

beforeAll(() => {
  runMigration();
  pool = testPool();
});

beforeEach(async () => {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE payment_proof_notification_outbox, payment_proofs, auth_sessions, users',
  );
  cooperativeId = await createCooperative();
  otherCooperativeId = await createCooperative();
  storageDirectory = await mkdtemp(path.join(os.tmpdir(), 'pagos02-http-'));
  fileKey = randomUUID();
  await writeFile(path.join(storageDirectory, fileKey), FILE_CONTENT, { flag: 'wx' });
  const auth = await createAuthModule({
    pool,
    env: { JWT_SECRET: randomBytes(32).toString('hex') },
  });
  payments = createPaymentsModule({
    pool,
    auth,
    env: { PAYMENT_PROOF_STORAGE_DIR: storageDirectory },
  });
  server = http.createServer(createApp({ auth, payments, pool }));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  if (storageDirectory) {
    await unlink(path.join(storageDirectory, fileKey));
    await rmdir(storageDirectory);
  }
  jest.restoreAllMocks();
});

afterAll(async () => {
  if (pool) await pool.end();
});

test('bandeja usa sesión real y solo devuelve pendientes de su cooperativa con total y sin claves', async () => {
  const own = await createProof();
  await createProof(otherCooperativeId);
  const { browser } = await signIn();

  const response = await browser.request(`${API}?cooperative_id=${otherCooperativeId}`);
  expect(response.status).toBe(200);
  const page = await response.json();
  expect(page.items).toHaveLength(1);
  expect(page.items[0]).toMatchObject({ id: own.id, totalCents: 875, currency: 'USD' });
  expect(page.items[0]).not.toHaveProperty('file_key');
  expect(page.items[0]).not.toHaveProperty('cooperative_id');
  expect(JSON.stringify(page)).not.toContain(fileKey);
});

test('archivo privado entrega bytes propios y hace indistinguibles el ajeno y el ausente', async () => {
  const own = await createProof();
  const foreign = await createProof(otherCooperativeId);
  const { browser } = await signIn();

  const response = await browser.request(`${API}/${own.id}/file`);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('image/png');
  expect(response.headers.get('content-disposition')).toContain('inline;');
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(Buffer.from(await response.arrayBuffer())).toEqual(FILE_CONTENT);
  const denied = await browser.request(`${API}/${foreign.id}/file`);
  const absent = await browser.request(`${API}/${randomUUID()}/file`);
  expect(denied.status).toBe(404);
  expect(absent.status).toBe(404);
  expect(await denied.json()).toEqual(await absent.json());
});

test('sin sesión no lista, lee ni inicia aprobación aunque el body declare un rol', async () => {
  const proof = await createProof();
  const browser = new Browser();

  expect((await browser.request(API)).status).toBe(401);
  expect((await browser.request(`${API}/${proof.id}/file`)).status).toBe(401);
  expect(
    (await browser.approve(proof.id, '', { role: 'CLERK', cooperative_id: cooperativeId })).status,
  ).toBe(401);
  expect((await persistedProof(proof.id)).approval_requested_at).toBeNull();
  expect(payments.bookingSaleConfirmer.confirmedSales.size).toBe(0);
});

test.each(['CUSTOMER', 'COOPERATIVE_ADMIN', 'SYSTEM_ADMIN'])(
  '%s no obtiene permisos de revisión o aprobación por tener una sesión válida',
  async (role) => {
    const proof = await createProof();
    const { browser } = await signIn(role);

    expect((await browser.request(API)).status).toBe(403);
    expect((await browser.request(`${API}/${proof.id}/file`)).status).toBe(403);
    expect((await browser.approve(proof.id)).status).toBe(403);
    expect((await persistedProof(proof.id)).approval_requested_at).toBeNull();
    expect(payments.bookingSaleConfirmer.confirmedSales.size).toBe(0);
  },
);

test('CSRF ausente o falso impide persistir intención y llamar al confirmador', async () => {
  const proof = await createProof();
  const { browser } = await signIn();

  for (const token of ['', 'csrf-falso']) {
    expect((await browser.approve(proof.id, token)).status).toBe(403);
  }
  expect((await persistedProof(proof.id)).approval_requested_at).toBeNull();
  expect(payments.bookingSaleConfirmer.confirmedSales.size).toBe(0);
});

test('aprobar y repetir conserva decisión y actor persistidos sin una segunda confirmación', async () => {
  const proof = await createProof();
  const { browser, userId } = await signIn();
  const confirm = jest.spyOn(payments.bookingSaleConfirmer, 'confirmSale');

  const first = await browser.approve(proof.id);
  const retry = await browser.approve(proof.id);
  expect(first.status).toBe(200);
  expect(retry.status).toBe(200);
  expect(await retry.json()).toEqual(await first.json());
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(confirm).toHaveBeenCalledWith({
    bookingId: proof.booking_id,
    cooperativeId,
    paymentProofId: proof.id,
  });
  const stored = await persistedProof(proof.id);
  expect(stored.approval_requested_by).toBe(userId);
  expect(stored.approved_by).toBe(userId);
  expect(stored.approved_at).toBeInstanceOf(Date);
  expect((await (await browser.request(API)).json()).items).toEqual([]);
  expect((await browser.request(`${API}/${proof.id}/file`)).status).toBe(409);
});

test('respuesta perdida conserva intención y permite reintento HTTP de otro CLERK con el actor original', async () => {
  const proof = await createProof();
  const firstClerk = await signIn();
  const retryClerk = await signIn();
  const confirmer = payments.bookingSaleConfirmer;
  const originalConfirm = confirmer.confirmSale.bind(confirmer);
  const confirm = jest.spyOn(confirmer, 'confirmSale').mockImplementationOnce(async (sale) => {
    await originalConfirm(sale);
    throw new Error('Respuesta perdida simulada');
  });

  const uncertain = await firstClerk.browser.approve(proof.id);
  expect(uncertain.status).toBe(503);
  expect((await uncertain.json()).error.code).toBe('BOOKING_SALE_UNCERTAIN');
  const pending = await persistedProof(proof.id);
  expect(pending.approval_requested_by).toBe(firstClerk.userId);
  expect(pending.approval_requested_at).toBeInstanceOf(Date);
  expect(pending.approved_at).toBeNull();
  expect(confirmer.confirmedSales.size).toBe(1);
  const recovered = await retryClerk.browser.approve(proof.id);
  expect(recovered.status).toBe(200);
  const stored = await persistedProof(proof.id);
  expect(stored.approval_requested_by).toBe(firstClerk.userId);
  expect(stored.approved_by).toBe(firstClerk.userId);
  expect(stored.approval_requested_at).toEqual(pending.approval_requested_at);
  expect(stored.approved_at).toBeInstanceOf(Date);
  expect(confirm).toHaveBeenCalledTimes(2);
  expect(confirm.mock.calls[0][0]).toEqual(confirm.mock.calls[1][0]);
  expect(confirmer.confirmedSales.size).toBe(1);
});

test('dos solicitudes concurrentes conservan un actor y una decisión en PostgreSQL', async () => {
  const proof = await createProof();
  const firstClerk = await signIn();
  const secondClerk = await signIn();

  const responses = await Promise.all([
    firstClerk.browser.approve(proof.id),
    secondClerk.browser.approve(proof.id),
  ]);
  expect(responses.map((response) => response.status)).toEqual([200, 200]);
  const bodies = await Promise.all(responses.map((response) => response.json()));
  expect(bodies[0]).toEqual(bodies[1]);
  const stored = await persistedProof(proof.id);
  expect([firstClerk.userId, secondClerk.userId]).toContain(stored.approval_requested_by);
  expect(stored.approved_by).toBe(stored.approval_requested_by);
  expect(stored.approved_at).toBeInstanceOf(Date);
  expect(payments.bookingSaleConfirmer.confirmedSales.size).toBe(1);
});

test.each(['revocada', 'vencida'])(
  'sesión %s se rechaza en una nueva solicitud sin iniciar intención',
  async (condition) => {
    const proof = await createProof();
    const { browser, userId } = await signIn();
    const query =
      condition === 'revocada'
        ? 'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1'
        : "UPDATE auth_sessions SET expires_at = CURRENT_TIMESTAMP - interval '1 minute' WHERE user_id = $1";
    await pool.query(query, [userId]);

    expect((await browser.request(API)).status).toBe(401);
    expect((await browser.approve(proof.id)).status).toBe(401);
    expect((await persistedProof(proof.id)).approval_requested_at).toBeNull();
    expect(payments.bookingSaleConfirmer.confirmedSales.size).toBe(0);
  },
);

test('un body con cooperativa ajena no permite aprobar fuera de la cooperativa autenticada', async () => {
  const foreign = await createProof(otherCooperativeId);
  const { browser } = await signIn();

  const response = await browser.approve(foreign.id, browser.csrf, {
    cooperative_id: otherCooperativeId,
    approved_by: randomUUID(),
  });
  const absent = await browser.approve(randomUUID());
  expect(response.status).toBe(404);
  expect(absent.status).toBe(404);
  expect(await response.json()).toEqual(await absent.json());
  expect((await persistedProof(foreign.id)).approval_requested_at).toBeNull();
  expect(payments.bookingSaleConfirmer.confirmedSales.size).toBe(0);
});

test('rechazo definitivo del confirmador no registra aprobación local', async () => {
  const proof = await createProof();
  const { browser, userId } = await signIn();
  payments.bookingSaleConfirmer.rejections.add(proof.id);

  const response = await browser.approve(proof.id);
  expect(response.status).toBe(409);
  expect((await response.json()).error.code).toBe('BOOKING_SALE_REJECTED');
  const stored = await persistedProof(proof.id);
  expect(stored.approval_requested_by).toBe(userId);
  expect(stored.approved_at).toBeNull();
  expect(payments.bookingSaleConfirmer.confirmedSales.size).toBe(0);
});
