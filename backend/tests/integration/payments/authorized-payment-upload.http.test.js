const http = require('node:http');
const { Blob } = require('node:buffer');
const { randomBytes, randomUUID } = require('node:crypto');
const { mkdtemp, readdir, readFile, writeFile, unlink, rmdir } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const createApp = require('../../../src/app');
const { createAuthModule } = require('../../../src/modules/auth');
const { createBookingsModule } = require('../../../src/modules/bookings');
const {
  createPaymentsModule,
  createPaymentReceiptModule,
  createPaymentReviewModule,
} = require('../../../src/modules/payments');
const PgBookingRepository = require('../../../src/modules/bookings/infrastructure/pg-booking.repository');
const {
  summaryInput,
  summaryContext,
} = require('../../unit/bookings/helpers/booking-summary-fixtures');
const { runMigration, testPool } = require('../../helpers/database');
const SessionBrowser = require('../../helpers/session-browser');
const FormData = globalThis.FormData;

const API = '/api/v1/payment-proofs';
const NOW = new Date('2026-11-03T14:01:00.000Z');
const STARTED_AT = new Date('2026-11-03T14:00:00.000Z');
const PDF = Buffer.from('%PDF-1.4\ncomprobante QA');
let pool, server, origin, storage, cooperativeId, auth, bookingModule, bookings, accounts;

beforeAll(() => {
  runMigration();
  pool = testPool();
});

beforeEach(async () => {
  accounts = [];
  bookings = [];
  storage = await mkdtemp(path.join(os.tmpdir(), 'pagos-upload-http-'));
  const ruc = randomUUID().replace(/\D/g, '').slice(0, 13).padStart(13, '7');
  cooperativeId = (
    await pool.query('INSERT INTO cooperatives(name,ruc) VALUES($1,$2) RETURNING id', [
      'Cooperativa QA carga',
      ruc,
    ])
  ).rows[0].id;
  auth = await createAuthModule({
    pool,
    env: { JWT_SECRET: randomBytes(48).toString('hex') },
  });
  bookingModule = createBookingsModule({ pool, auth, clock: () => new Date(NOW) });
  const paymentReceipt = createPaymentReceiptModule({
    pool,
    createPaymentProofReceiver: bookingModule.createPaymentProofReceiver,
  });
  const payments = createPaymentsModule({
    pool,
    auth,
    env: { PAYMENT_PROOF_STORAGE_DIR: storage },
    paymentQueries: bookingModule.paymentQueries,
    bookingPaymentProofNotifier: paymentReceipt.bookingPaymentProofNotifier,
    clock: () => new Date(NOW),
  });
  const paymentReview = createPaymentReviewModule({
    pool,
    auth,
    paymentQueries: bookingModule.paymentQueries,
    env: { PAYMENT_PROOF_STORAGE_DIR: storage },
  });
  server = http.createServer(
    createApp({ pool, auth, bookings: bookingModule, payments, paymentReview }),
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  for (const booking of bookings) {
    await pool.query('DELETE FROM booking_proof_receipt_results WHERE booking_id=$1', [booking.id]);
    await pool.query('DELETE FROM payment_proof_notification_outbox WHERE booking_id=$1', [
      booking.id,
    ]);
    await pool.query('DELETE FROM payment_proofs WHERE booking_id=$1', [booking.id]);
    await pool.query('DELETE FROM booking_seat_allocations WHERE booking_id=$1', [booking.id]);
    await pool.query('DELETE FROM bookings WHERE id=$1', [booking.id]);
    await pool.query('DELETE FROM booking_trip_locks WHERE cooperative_id=$1 AND trip_id=$2', [
      cooperativeId,
      booking.tripId,
    ]);
  }
  for (const account of accounts) {
    await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [account.userId]);
    await pool.query('DELETE FROM users WHERE id=$1', [account.userId]);
  }
  if (cooperativeId) await pool.query('DELETE FROM cooperatives WHERE id=$1', [cooperativeId]);
  if (storage) {
    for (const name of await readdir(storage)) await unlink(path.join(storage, name));
    await rmdir(storage);
  }
  server = null;
  storage = null;
});

afterAll(async () => {
  if (pool) await pool.end();
});

async function registerCustomer() {
  const browser = new SessionBrowser(origin);
  const email = `qa-upload-${randomUUID()}@qa.invalid`;
  const password = randomBytes(24).toString('hex');
  await browser.token();
  expect((await browser.request('/api/v1/auth/register', 'POST', { email, password })).status).toBe(
    201,
  );
  const userId = (await pool.query('SELECT id FROM users WHERE email=$1', [email])).rows[0].id;
  await browser.login(email, password);
  const account = { browser, email, password, userId };
  accounts.push(account);
  return account;
}

async function createBooking(ownerId, bookingId = `booking:${randomUUID()}`) {
  const tripId = `trip:${randomUUID()}`;
  const base = summaryContext();
  const context = {
    ...base,
    bookingId,
    ownerId,
    startedAt: STARTED_AT,
    proofWindowSeconds: 300,
    trip: { ...base.trip, tripId, cooperativeId },
  };
  const input = { ...summaryInput(), tripId, summaryAccepted: true };
  await new PgBookingRepository({ pool }).reserve({ tripId, cooperativeId }, async () => ({
    input,
    context,
  }));
  bookings.push({ id: bookingId, tripId });
  return bookingId;
}

async function createBookingProofForm(browser, bookingId) {
  const form = new FormData();
  form.set('bookingId', bookingId);
  form.set('file', new Blob([PDF], { type: 'application/pdf' }), 'transfer.pdf');
  const cookie = [...browser.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  return fetch(origin + API, {
    method: 'POST',
    headers: { cookie, 'X-CSRF-Token': browser.csrf },
    body: form,
  });
}

test('autoriza UPLOAD_PROOF, conserva ID opaco y registra procedencia con recepción real', async () => {
  const customer = await registerCustomer();
  const bookingId = await createBooking(customer.userId);

  const response = await createBookingProofForm(customer.browser, bookingId);
  const body = await response.json();
  expect(response.status).toBe(201);
  expect(body.paymentProof).toMatchObject({ status: 'UPLOADED' });
  expect(body.paymentProof.expiresAt).toBe('2026-11-03T14:05:00.000Z');
  expect(JSON.stringify(body)).not.toContain('upload_authorized_by');

  const proof = (await pool.query('SELECT * FROM payment_proofs WHERE booking_id=$1', [bookingId]))
    .rows[0];
  expect(proof).toMatchObject({
    booking_id: bookingId,
    cooperative_id: cooperativeId,
    status: 'UPLOADED',
    upload_authorized_by: customer.userId,
  });
  expect(proof.upload_authorized_at).toBeInstanceOf(Date);
  const outbox = (
    await pool.query('SELECT * FROM payment_proof_notification_outbox WHERE booking_id=$1', [
      bookingId,
    ])
  ).rows[0];
  expect(outbox).toMatchObject({ status: 'DELIVERED', attempt_count: 1 });
  const receipt = (
    await pool.query('SELECT * FROM booking_proof_receipt_results WHERE booking_id=$1', [bookingId])
  ).rows[0];
  expect(receipt).toMatchObject({ booking_id: bookingId, outcome: 'ACCEPTED' });
  const booking = (
    await pool.query('SELECT proof_reception_state FROM bookings WHERE id=$1', [bookingId])
  ).rows[0];
  expect(booking.proof_reception_state).toBe('RECEIVED');
  expect(await readdir(storage)).toEqual([proof.file_key]);
  expect(await readFile(path.join(storage, proof.file_key))).toEqual(PDF);
});

test('reintento autenticado conserva comprobante, archivo y recepción idempotente', async () => {
  const customer = await registerCustomer();
  const bookingId = await createBooking(customer.userId);

  const first = await createBookingProofForm(customer.browser, bookingId);
  const firstBody = await first.json();
  const second = await createBookingProofForm(customer.browser, bookingId);
  const secondBody = await second.json();
  expect(first.status).toBe(201);
  expect(second.status).toBe(201);
  expect(secondBody.paymentProof.id).toBe(firstBody.paymentProof.id);
  expect(
    await pool.query('SELECT id FROM payment_proofs WHERE booking_id=$1', [bookingId]),
  ).toMatchObject({
    rows: [{ id: firstBody.paymentProof.id }],
  });
  expect(
    (
      await pool.query(
        'SELECT attempt_count,status FROM payment_proof_notification_outbox WHERE booking_id=$1',
        [bookingId],
      )
    ).rows[0],
  ).toMatchObject({ attempt_count: 2, status: 'DELIVERED' });
  expect(await readdir(storage)).toHaveLength(1);
  expect(
    (
      await pool.query(
        'SELECT count(*)::int AS count FROM booking_proof_receipt_results WHERE booking_id=$1',
        [bookingId],
      )
    ).rows[0].count,
  ).toBe(1);
});

test('reserva ajena e inexistente devuelven 404 sin guardar archivo o comprobante', async () => {
  const customer = await registerCustomer();
  const other = await registerCustomer();
  const foreignBookingId = await createBooking(other.userId);
  const missingBookingId = `missing:${randomUUID()}`;
  const missing = await createBookingProofForm(customer.browser, missingBookingId);
  const foreign = await createBookingProofForm(customer.browser, foreignBookingId);

  expect(missing.status).toBe(404);
  expect(foreign.status).toBe(404);
  expect(
    await pool.query('SELECT id FROM payment_proofs WHERE booking_id = ANY($1::text[])', [
      [missingBookingId, foreignBookingId],
    ]),
  ).toMatchObject({ rows: [] });
  expect(await readdir(storage)).toEqual([]);
  expect(
    (await pool.query('SELECT proof_reception_state FROM bookings WHERE id=$1', [foreignBookingId]))
      .rows[0].proof_reception_state,
  ).toBe('NOT_RECEIVED');
});

test('Auth deniega antes de parsear o guardar una carga sin sesión', async () => {
  const customer = await registerCustomer();
  const bookingId = await createBooking(customer.userId);

  const response = await fetch(origin + API, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'formulario inválido',
  });

  expect(response.status).toBe(401);
  expect(
    await pool.query('SELECT id FROM payment_proofs WHERE booking_id=$1', [bookingId]),
  ).toMatchObject({ rows: [] });
  expect(await readdir(storage)).toEqual([]);
});

test('completa una fila AWAITING_UPLOAD solo tras autorización nueva', async () => {
  const customer = await registerCustomer();
  const bookingId = await createBooking(customer.userId);
  const proofId = randomUUID();
  await pool.query('INSERT INTO payment_proofs(id,booking_id,cooperative_id) VALUES($1,$2,$3)', [
    proofId,
    bookingId,
    cooperativeId,
  ]);

  const response = await createBookingProofForm(customer.browser, bookingId);
  expect(response.status).toBe(201);
  const proof = (await pool.query('SELECT * FROM payment_proofs WHERE booking_id=$1', [bookingId]))
    .rows[0];
  expect(proof.id).toBe(proofId);
  expect(proof.status).toBe('UPLOADED');
  expect(proof.upload_authorized_by).toBe(customer.userId);
  expect(
    (
      await pool.query('SELECT status FROM payment_proof_notification_outbox WHERE booking_id=$1', [
        bookingId,
      ])
    ).rows[0].status,
  ).toBe('DELIVERED');
});

test('comprobante histórico sin procedencia requiere conciliación y conserva sus bytes', async () => {
  const customer = await registerCustomer();
  const bookingId = await createBooking(customer.userId);
  const proofId = randomUUID();
  const key = randomUUID();
  await writeFile(path.join(storage, key), PDF);
  await pool.query(
    `INSERT INTO payment_proofs(id,booking_id,cooperative_id,status,file_key,original_file_name,
      media_type,file_size_bytes,uploaded_at) VALUES($1,$2,$3,'UPLOADED',$4,'legacy.pdf',
      'application/pdf',$5,$6)`,
    [proofId, bookingId, cooperativeId, key, PDF.length, NOW],
  );
  await pool.query(
    'INSERT INTO payment_proof_notification_outbox(payment_proof_id,booking_id) VALUES($1,$2)',
    [proofId, bookingId],
  );

  const response = await createBookingProofForm(customer.browser, bookingId);
  const body = await response.json();
  expect(response.status).toBe(409);
  expect(body.error.code).toBe('PAYMENT_PROOF_RECONCILIATION_REQUIRED');
  expect((await readdir(storage)).sort()).toEqual([key]);
  expect(await readFile(path.join(storage, key))).toEqual(PDF);
  expect(
    (
      await pool.query(
        'SELECT status,attempt_count FROM payment_proof_notification_outbox WHERE booking_id=$1',
        [bookingId],
      )
    ).rows[0],
  ).toMatchObject({ status: 'PENDING', attempt_count: 0 });
  expect(
    (
      await pool.query(
        'SELECT upload_authorized_by,upload_authorized_at FROM payment_proofs WHERE id=$1',
        [proofId],
      )
    ).rows[0],
  ).toEqual({ upload_authorized_by: null, upload_authorized_at: null });
  expect(
    (await pool.query('SELECT proof_reception_state FROM bookings WHERE id=$1', [bookingId]))
      .rows[0].proof_reception_state,
  ).toBe('NOT_RECEIVED');
});
