const http = require('node:http');
const { randomBytes, randomUUID } = require('node:crypto');
const { mkdtemp, writeFile, unlink, rmdir } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const createApp = require('../../../src/app');
const { createAuthModule } = require('../../../src/modules/auth');
const {
  createPaymentsModule,
  createPaymentReviewModule,
} = require('../../../src/modules/payments');
const { runMigration, testPool } = require('../../helpers/database');
const SessionBrowser = require('../../helpers/session-browser');

const API = '/api/v1/payment-proofs';
let pool, server, origin, tenant, otherTenant, storage, key, provider, legacyPayments, authModule;
const records = new Map();
const bytes = Buffer.from('bytes-exclusivos-de-QA');
async function cooperative() {
  const ruc = randomUUID().replace(/\D/g, '').slice(0, 13).padStart(13, '7');
  return (
    await pool.query('INSERT INTO cooperatives(name,ruc) VALUES($1,$2) RETURNING id', [
      'Cooperativa QA lector',
      ruc,
    ])
  ).rows[0].id;
}
async function login(role = 'CLERK', cooperativeId = tenant, targetOrigin = origin) {
  const browser = new SessionBrowser(targetOrigin);
  const email = `qa-${randomUUID()}@qa.invalid`;
  const password = randomBytes(24).toString('hex');
  await browser.token();
  expect((await browser.request('/api/v1/auth/register', 'POST', { email, password })).status).toBe(
    201,
  );
  const { rows } = await pool.query(
    'UPDATE users SET role=$1,cooperative_id=$2 WHERE email=$3 RETURNING id',
    [role, role === 'CUSTOMER' ? null : cooperativeId, email],
  );
  await browser.login(email, password);
  return { browser, userId: rows[0].id };
}
async function proof(cooperativeId = tenant) {
  const bookingId = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO payment_proofs(booking_id,cooperative_id,status,file_key,original_file_name,media_type,file_size_bytes,uploaded_at)
    VALUES($1,$2,'UPLOADED',$3,'qa.png','image/png',$4,CURRENT_TIMESTAMP) RETURNING id`,
    [bookingId, cooperativeId, key, bytes.length],
  );
  records.set(bookingId, {
    bookingId,
    cooperativeId,
    status: 'PENDING_PAYMENT',
    totalPriceCents: 875,
    currency: 'USD',
    createdAt: '2026-11-03T00:00:00.000Z',
    proofWindowStartedAt: '2026-11-03T00:01:00.000Z',
    proofWindowSeconds: 300,
    expiresAt: '2026-11-03T00:06:00.000Z',
    evaluatedAt: '2026-11-03T00:07:00.000Z',
    canUploadProof: false,
  });
  return { id: rows[0].id, bookingId };
}
beforeAll(() => {
  runMigration();
  pool = testPool();
});
beforeEach(async () => {
  records.clear();
  tenant = await cooperative();
  otherTenant = await cooperative();
  storage = await mkdtemp(path.join(os.tmpdir(), 'pagos-lector-http-'));
  key = randomUUID();
  await writeFile(path.join(storage, key), bytes);
  provider = { findForPayment: jest.fn(async ({ bookingId }) => records.get(bookingId) ?? null) };
  authModule = await createAuthModule({
    pool,
    env: { JWT_SECRET: randomBytes(48).toString('hex') },
  });
  const paymentReview = createPaymentReviewModule({
    pool,
    auth: authModule,
    paymentQueries: provider,
    env: { PAYMENT_PROOF_STORAGE_DIR: storage },
  });
  legacyPayments = createPaymentsModule({
    pool,
    auth: authModule,
    env: { PAYMENT_PROOF_STORAGE_DIR: storage },
  });
  jest.spyOn(legacyPayments.bookingReader, 'findForPayment');
  server = http.createServer(
    createApp({ pool, auth: authModule, paymentReview, payments: legacyPayments }),
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  await unlink(path.join(storage, key));
  await rmdir(storage);
});
afterAll(async () => {
  await pool.end();
});

test('contexto real de Auth y tenant fijados por servidor; DTO conserva contrato y privacidad', async () => {
  const own = await proof();
  await proof(otherTenant);
  const { browser, userId } = await login();
  const response = await browser.request(`${API}?cooperativeId=${otherTenant}&userId=falso`);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const page = await response.json();
  expect(page.items).toHaveLength(1);
  expect(page.items[0]).toMatchObject({
    id: own.id,
    bookingId: own.bookingId,
    totalCents: 875,
    currency: 'USD',
  });
  expect(page.items[0]).not.toHaveProperty('file_key');
  expect(page.items[0]).not.toHaveProperty('ownerId');
  expect(provider.findForPayment).toHaveBeenCalledWith(
    { bookingId: own.bookingId, purpose: 'REVIEW_PAYMENT' },
    { userId, role: 'CLERK', cooperativeId: tenant },
  );
  expect(legacyPayments.bookingReader.findForPayment).not.toHaveBeenCalled();
});

test.each(['CUSTOMER', 'COOPERATIVE_ADMIN'])('rol %s no consulta el proveedor', async (role) => {
  await proof();
  const { browser } = await login(role);
  expect((await browser.request(API)).status).toBe(403);
  expect(provider.findForPayment).not.toHaveBeenCalled();
});

test('sin sesión listado y archivo quedan denegados con no-store', async () => {
  const own = await proof();
  for (const route of [API, `${API}/${own.id}/file`]) {
    const response = await fetch(origin + route);
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await response.json();
  }
  expect(provider.findForPayment).not.toHaveBeenCalled();
});

test('archivo propio conserva bytes y no permite leer el de otra cooperativa', async () => {
  const own = await proof();
  const other = await proof(otherTenant);
  const { browser } = await login();
  const response = await browser.request(`${API}/${own.id}/file`);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
  expect((await browser.request(`${API}/${other.id}/file`)).status).toBe(404);
});

test('null y reserva ajena son integridad 500, sin lista parcial', async () => {
  const own = await proof();
  const { browser } = await login();
  records.delete(own.bookingId);
  let response = await browser.request(API);
  expect(response.status).toBe(500);
  expect((await response.json()).error.code).toBe('BOOKING_DATA_INTEGRITY_ERROR');
  records.set(own.bookingId, { bookingId: own.bookingId, cooperativeId: otherTenant });
  response = await browser.request(API);
  expect(response.status).toBe(500);
  expect((await response.json()).error.code).toBe('BOOKING_DATA_INTEGRITY_ERROR');
});

test('errores públicos mantienen clasificación HTTP segura sin SQL del proveedor', async () => {
  await proof();
  const { browser } = await login();
  for (const [code, status] of [
    ['UNAUTHENTICATED', 401],
    ['FORBIDDEN', 403],
    ['BOOKING_VALIDATION_ERROR', 400],
    ['BOOKING_DATA_INTEGRITY_ERROR', 500],
    ['BOOKING_QUERY_UNAVAILABLE', 503],
    ['no-clasificado', 500],
  ]) {
    provider.findForPayment.mockRejectedValue(
      Object.assign(new Error('SQL secreto de QA'), { code }),
    );
    const response = await browser.request(API);
    expect(response.status).toBe(status);
    const data = await response.json();
    expect(data.error.code).toBe(code === 'no-clasificado' ? 'INTERNAL_ERROR' : code);
    expect(JSON.stringify(data)).not.toContain('SQL secreto');
  }
});

test('composición exige proveedor explícito y no ofrece mutaciones de pago', async () => {
  expect(() => createPaymentReviewModule({ pool })).toThrow('paymentQueries.findForPayment');
  const reviewOnly = createPaymentReviewModule({
    pool,
    auth: authModule,
    paymentQueries: provider,
  });
  const readOnlyServer = http.createServer(
    createApp({ pool, auth: authModule, paymentReview: reviewOnly }),
  );
  await new Promise((resolve) => readOnlyServer.listen(0, '127.0.0.1', resolve));
  const targetOrigin = `http://127.0.0.1:${readOnlyServer.address().port}`;
  try {
    const { browser } = await login('CLERK', tenant, targetOrigin);
    expect((await browser.request(API, 'POST', {})).status).toBe(404);
    expect((await browser.request(`${API}/${randomUUID()}/approve`, 'POST', {})).status).toBe(404);
  } finally {
    await new Promise((resolve) => readOnlyServer.close(resolve));
  }
});
