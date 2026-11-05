const http = require('node:http');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const createApp = require('../../../src/app');
const { createAuthModule } = require('../../../src/modules/auth');
const { createBookingTicketQueries } = require('../../../src/modules/bookings');
const PgBookingSaleConfirmer = require('../../../src/modules/bookings/infrastructure/pg-booking-sale-confirmer');
const { createTicketsModule } = require('../../../src/modules/tickets');
const {
  createGoogleWalletLinkSigner,
} = require('../../../src/modules/tickets/infrastructure/google-wallet-link-signer');
const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { soldRowWithTrip } = require('../../helpers/sold-booking-ticket-trip');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const EMAIL = 'wallet@transviaje-test.iam.gserviceaccount.com';
const ISSUER = '3388000000012345678';
const SAVE_PREFIX = 'https://pay.google.com/gp/v/save/';
const env = {
  JWT_SECRET: 'secreto-ficticio-solo-para-pruebas-http-123456',
  JWT_EXPIRES_IN: '30m',
};
const bookingId = 'venta-opaca/qa';
const path = `/api/v1/tickets/bookings/${encodeURIComponent(bookingId)}`;
let pool, server, url, disabledServer, disabledUrl;
let owner, stranger;

async function customer() {
  const id = randomUUID();
  const sid = randomUUID();
  await pool.query(
    `INSERT INTO users (id,email,password_hash,role)
     VALUES ($1,$2,'hash-no-utilizado-en-autenticacion-de-sesion','CUSTOMER')`,
    [id, `cliente-${id}@example.ec`],
  );
  await pool.query(
    `INSERT INTO auth_sessions (id,user_id,expires_at) VALUES ($1,$2,CURRENT_TIMESTAMP + interval '1 hour')`,
    [sid, id],
  );
  const token = jwt.sign({ sub: id, sid, role: 'CUSTOMER', cooperative_id: null }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '30m',
  });
  return { id, cookie: `access_token=${token}` };
}

function get(target, who, base = url) {
  return fetch(base + target, { headers: who ? { cookie: who.cookie } : {} });
}

const walletPath = (ticketId) => `${path}/tickets/${encodeURIComponent(ticketId)}/google-wallet`;

function decodeSaveUrl(saveUrl) {
  const [header, claims, signature] = saveUrl.slice(SAVE_PREFIX.length).split('.');
  return {
    claims: JSON.parse(Buffer.from(claims, 'base64url')),
    valid: crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${header}.${claims}`),
      publicKey,
      Buffer.from(signature, 'base64url'),
    ),
  };
}

async function confirm() {
  const confirmer = new PgBookingSaleConfirmer({
    pool,
    clock: () => new Date('2026-11-04T14:02:00Z'),
  });
  await expect(
    confirmer.confirmSale({
      bookingId,
      cooperativeId: 'coop-ticket',
      paymentProofId: 'proof-ticket',
    }),
  ).resolves.toBe(true);
}

beforeAll(async () => {
  assertTestDatabase();
  runMigration();
  pool = testPool();
  const auth = await createAuthModule({ pool, env });
  const googleWallet = {
    enabled: true,
    issuerId: ISSUER,
    classSuffix: 'transviaje_bus',
    signer: createGoogleWalletLinkSigner({
      serviceAccountEmail: EMAIL,
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
      origins: ['http://localhost:8088'],
    }),
  };
  const soldBookings = createBookingTicketQueries({ pool });
  const tickets = createTicketsModule({ pool, auth, soldBookings, googleWallet });
  server = http.createServer(createApp({ auth, tickets, pool }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
  const disabled = createTicketsModule({ pool, auth, soldBookings });
  disabledServer = http.createServer(createApp({ auth, tickets: disabled, pool }));
  await new Promise((resolve) => disabledServer.listen(0, '127.0.0.1', resolve));
  disabledUrl = `http://127.0.0.1:${disabledServer.address().port}`;
});

beforeEach(async () => {
  assertTestDatabase();
  await pool.query(
    'TRUNCATE tickets, auth_sessions, users, booking_guest_access_tokens, booking_benefit_reviews, booking_proof_receipt_results, booking_seat_allocations, bookings, booking_trip_locks CASCADE',
  );
  owner = await customer();
  stranger = await customer();
  const row = soldRowWithTrip();
  await pool.query("INSERT INTO booking_trip_locks VALUES('coop-ticket','trip-ticket')");
  await pool.query(
    `INSERT INTO bookings(id,cooperative_id,trip_id,owner_id,from_position,to_position,status,summary,
    base_price_cents,discount_cents,total_price_cents,created_at,expires_at,
    proof_window_started_at,proof_window_seconds,proof_reception_state,accepted_proof_id,proof_received_at)
    VALUES($1,'coop-ticket','trip-ticket',$2,0,1,'PENDING_PAYMENT',$3,
    1000,0,1000,'2026-11-04T14:00:00Z','2026-11-04T14:05:00Z',
    '2026-11-04T14:00:00Z',300,'RECEIVED','proof-ticket','2026-11-04T14:01:00Z')`,
    [bookingId, owner.id, row.summary],
  );
  for (const p of row.summary.passengers)
    await pool.query(
      `INSERT INTO booking_seat_allocations VALUES($1,'coop-ticket','trip-ticket',$2,0,1,'RESERVED',true)`,
      [bookingId, p.seatId],
    );
});

afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (disabledServer) await new Promise((resolve) => disabledServer.close(resolve));
  if (pool) {
    await pool.query(
      'TRUNCATE tickets, auth_sessions, users, booking_seat_allocations, bookings, booking_trip_locks CASCADE',
    );
    await pool.end();
  }
});

describe('BOLETOS-03: Google Wallet por HTTP', () => {
  test('el estado indica si Google Wallet está habilitado y exige sesión', async () => {
    expect((await get('/api/v1/tickets/google-wallet/status')).status).toBe(401);
    const enabled = await get('/api/v1/tickets/google-wallet/status', owner);
    expect(enabled.headers.get('cache-control')).toBe('no-store');
    expect(await enabled.json()).toEqual({ enabled: true });
    const disabled = await get('/api/v1/tickets/google-wallet/status', owner, disabledUrl);
    expect(await disabled.json()).toEqual({ enabled: false });
  });

  test('el propietario recibe un enlace firmado con el QR de su boleto', async () => {
    await confirm();
    const { tickets } = await (await get(path, owner)).json();
    const [ticket] = tickets;
    const response = await get(walletPath(ticket.ticketId), owner);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const { saveUrl } = await response.json();
    expect(saveUrl.startsWith(SAVE_PREFIX)).toBe(true);
    expect(saveUrl.length).toBeLessThanOrEqual(1800);
    const { claims, valid } = decodeSaveUrl(saveUrl);
    expect(valid).toBe(true);
    expect(claims).toMatchObject({ iss: EMAIL, aud: 'google', typ: 'savetowallet' });
    const [object] = claims.payload.transitObjects;
    expect(object.id).toBe(`${ISSUER}.${ticket.ticketId}`);
    expect(object.barcode.value).toBe(ticket.qrPayload);
    expect(object.ticketLeg.originName.defaultValue.value).toBe('Ambato');
    const json = JSON.stringify(claims);
    for (const t of tickets) {
      expect(json).not.toContain(t.passenger.identificationNumber);
      expect(json).not.toContain(t.passenger.fullName);
    }
  });

  test('otro cliente, una reserva no pagada o un boleto ajeno reciben 404 sin firmar', async () => {
    const pending = await get(walletPath('cualquiera'), owner);
    await confirm();
    const { tickets } = await (await get(path, owner)).json();
    const foreign = await get(walletPath(tickets[0].ticketId), stranger);
    const unknown = await get(walletPath('boleto-ajeno'), owner);
    expect([pending.status, foreign.status, unknown.status]).toEqual([404, 404, 404]);
    for (const r of [pending, foreign, unknown])
      expect((await r.json()).error.code).toBe('TICKET_NOT_FOUND');
  });

  test('sin configuración el enlace responde 503 sin emitir boletos', async () => {
    await confirm();
    const response = await get(walletPath('cualquiera'), owner, disabledUrl);
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('GOOGLE_WALLET_DISABLED');
    expect((await pool.query('SELECT count(*)::int AS n FROM tickets')).rows[0].n).toBe(0);
  });
});
