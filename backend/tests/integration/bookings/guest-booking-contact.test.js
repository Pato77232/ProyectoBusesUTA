const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { runMigration, testPool } = require('../../helpers/database');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { createBookingsModule } = require('../../../src/modules/bookings');
const { createGuestEmailAccess } = require('../../../src/modules/auth');
const purchaseSetup = require('../../unit/bookings/helpers/booking-purchase-fixtures');

let pool;
const clock = () => new Date('2026-10-27T15:00:00.000Z');
const auth = { authenticate() {}, authorize: () => () => {}, csrfProtection() {} };

beforeAll(() => {
  runMigration();
  pool = testPool();
});
beforeEach(async () => {
  assertTestDatabase();
  await pool.query(`TRUNCATE auth_guest_sessions, auth_guest_verifications, auth_guest_buyers,
    booking_guest_access_tokens, booking_proof_receipt_results,
    booking_seat_allocations, bookings, booking_trip_locks CASCADE`);
});
afterAll(async () => {
  if (pool) {
    await pool.query(`TRUNCATE auth_guest_sessions, auth_guest_verifications, auth_guest_buyers,
      booking_guest_access_tokens, booking_proof_receipt_results,
      booking_seat_allocations, bookings, booking_trip_locks CASCADE`);
    await pool.end();
  }
});

async function verifiedSession(access, email) {
  const challenge = await access.issue(email);
  const session = await access.redeem(challenge.token);
  return { guestSessionToken: session.sessionToken };
}

test('fija el correo acreditado en la reserva y Pagos solo consulta la compra del comprador verificado', async () => {
  const access = createGuestEmailAccess({ pool, env: {}, clock });
  const fixture = purchaseSetup();
  const bookings = createBookingsModule({
    pool,
    auth,
    env: { BOOKING_PROOF_WINDOW_SECONDS: '180' },
    tripCatalog: fixture.dependencies.tripCatalog,
    passengerVerifier: fixture.dependencies.passengerVerifier,
    guestEmailAccess: access,
    clock,
    calendarDateAt: fixture.dependencies.calendarDateAt,
    newId: randomUUID,
  });
  const ownSession = await verifiedSession(access, ' Invitada@Example.ec ');
  const preview = await bookings.guestPurchase.getSummary(fixture.input, ownSession);
  const booking = await bookings.guestPurchase.createBooking(
    {
      ...fixture.input,
      summaryAccepted: true,
      acceptedSummaryRevision: preview.summaryRevision,
      requestKey: randomUUID(),
    },
    ownSession,
  );
  const { rows } = await pool.query(
    'SELECT owner_id, guest_contact_email FROM bookings WHERE id=$1',
    [booking.bookingId],
  );
  expect(rows[0]).toEqual({
    owner_id: expect.stringMatching(/^guest:[a-f0-9-]{36}$/),
    guest_contact_email: 'invitada@example.ec',
  });
  const rollback = spawnSync(
    process.execPath,
    [
      '-e',
      "const {migrate}=require(process.argv[1]);migrate(process.env.DATABASE_URL,'down').catch(error=>{process.stdout.write(error.code||'UNKNOWN');process.exitCode=1})",
      require.resolve('../../../scripts/migrate'),
    ],
    { env: process.env, encoding: 'utf8' },
  );
  expect(rollback.status).toBe(1);
  expect(rollback.stdout).toBe('P0001');
  expect(
    (await pool.query('SELECT guest_contact_email FROM bookings WHERE id=$1', [booking.bookingId]))
      .rows[0].guest_contact_email,
  ).toBe('invitada@example.ec');
  const query = { bookingId: booking.bookingId, purpose: 'UPLOAD_PROOF' };
  expect(await bookings.guestPurchase.findForPayment(query, ownSession)).toMatchObject({
    bookingId: booking.bookingId,
    ownerId: rows[0].owner_id,
    canUploadProof: true,
  });
  const otherSession = await verifiedSession(access, 'otra@example.ec');
  expect(await bookings.guestPurchase.findForPayment(query, otherSession)).toBeNull();
  await expect(
    bookings.paymentQueries.findForPayment(query, {
      userId: rows[0].owner_id,
      role: 'GUEST_BUYER',
      cooperativeId: null,
    }),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  await access.revoke(ownSession.guestSessionToken);
  await expect(bookings.guestPurchase.findForPayment(query, ownSession)).rejects.toMatchObject({
    code: 'UNAUTHENTICATED',
  });
});
