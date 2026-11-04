// INTEG-01 T3: el rechazo HTTP llega al caso de uso con actor y cooperativa de la sesión.
const http = require('node:http');
const { randomBytes, randomUUID } = require('node:crypto');
const createApp = require('../../../src/app');
const { createAuthModule } = require('../../../src/modules/auth');
const { createPaymentsModule } = require('../../../src/modules/payments');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { runMigration, testPool } = require('../../helpers/database');

const API = '/api/v1/payment-proofs';
let pool;
let server;
let baseUrl;
let confirmer;
let cooperativeId;
let otherCooperativeId;

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
    this.csrf = (await response.json()).csrfToken;
  }

  reject(proofId, body, csrf = this.csrf) {
    return this.request(`${API}/${proofId}/reject`, 'POST', body, csrf);
  }
}

async function createCooperative() {
  const ruc = randomUUID().replace(/\D/g, '').slice(0, 13).padStart(13, '7');
  const { rows } = await pool.query(
    'INSERT INTO cooperatives(name, ruc) VALUES ($1, $2) RETURNING id',
    ['Cooperativa sintética rechazo', ruc],
  );
  return rows[0].id;
}

async function signInClerk() {
  const browser = new Browser();
  const email = `qa-${randomUUID()}@example.ec`;
  const password = randomBytes(24).toString('hex');
  await browser.token();
  expect((await browser.request('/api/v1/auth/register', 'POST', { email, password })).status).toBe(
    201,
  );
  // Solo fixture en BD de prueba: no presupone un endpoint productivo de alta CLERK.
  const { rows } = await pool.query(
    "UPDATE users SET role = 'CLERK', cooperative_id = $1 WHERE email = $2 RETURNING id",
    [cooperativeId, email],
  );
  expect((await browser.request('/api/v1/auth/login', 'POST', { email, password })).status).toBe(
    200,
  );
  await browser.token();
  return { browser, userId: rows[0].id };
}

async function createProof(tenantId = cooperativeId) {
  const { rows } = await pool.query(
    `INSERT INTO payment_proofs(
      booking_id, cooperative_id, status, file_key, original_file_name,
      media_type, file_size_bytes, uploaded_at
    ) VALUES ($1, $2, 'UPLOADED', $3, 'comprobante.png', 'image/png', 10, CURRENT_TIMESTAMP)
    RETURNING *`,
    [randomUUID(), tenantId, randomUUID()],
  );
  return rows[0];
}

const persisted = async (proofId) =>
  (await pool.query('SELECT * FROM payment_proofs WHERE id = $1', [proofId])).rows[0];

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
  confirmer = { confirmSale: jest.fn(), rejectSale: jest.fn().mockResolvedValue(true) };
  const auth = await createAuthModule({
    pool,
    env: { JWT_SECRET: randomBytes(32).toString('hex') },
  });
  const payments = createPaymentsModule({ pool, auth, bookingSaleConfirmer: confirmer });
  server = http.createServer(createApp({ auth, payments, pool }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
});

afterAll(async () => {
  if (pool) await pool.end();
});

test('CLERK rechaza con motivo, libera la venta en Reservas y conserva actor y motivo', async () => {
  const { browser, userId } = await signInClerk();
  const proof = await createProof();
  const response = await browser.reject(proof.id, { justification: '  Monto no coincide  ' });
  expect(response.status).toBe(200);
  expect((await response.json()).paymentProof).toMatchObject({
    id: proof.id,
    decision: 'REJECTED',
  });
  expect(confirmer.rejectSale).toHaveBeenCalledTimes(1);
  expect(confirmer.rejectSale).toHaveBeenCalledWith({
    bookingId: proof.booking_id,
    cooperativeId,
    paymentProofId: proof.id,
    rejectedBy: userId,
    justification: 'Monto no coincide',
  });
  expect(await persisted(proof.id)).toMatchObject({
    rejected_by: userId,
    rejection_justification: 'Monto no coincide',
  });
  expect(confirmer.confirmSale).not.toHaveBeenCalled();
});

test('sin justificación responde 400 sin avisar a Reservas ni cambiar el comprobante', async () => {
  const { browser } = await signInClerk();
  const proof = await createProof();
  for (const body of [{}, { justification: '   ' }]) {
    const response = await browser.reject(proof.id, body);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('PAYMENT_PROOF_VALIDATION_ERROR');
  }
  expect(confirmer.rejectSale).not.toHaveBeenCalled();
  expect(await persisted(proof.id)).toEqual(proof);
});

test('comprobante de otra cooperativa, sin CSRF o sin sesión no se rechaza', async () => {
  const { browser } = await signInClerk();
  const foreign = await createProof(otherCooperativeId);
  expect((await browser.reject(foreign.id, { justification: 'Ajeno' })).status).toBe(404);
  const own = await createProof();
  expect((await browser.reject(own.id, { justification: 'Sin CSRF' }, '')).status).toBe(403);
  const anonymous = new Browser();
  await anonymous.token();
  expect((await anonymous.reject(own.id, { justification: 'Sin sesión' })).status).toBe(401);
  expect(confirmer.rejectSale).not.toHaveBeenCalled();
  expect(await persisted(foreign.id)).toEqual(foreign);
  expect(await persisted(own.id)).toEqual(own);
});
