// PAGOS-02 §19. Ejecución explícita con snapshot externo; nunca omitir por configuración.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { randomUUID, randomBytes } = require('node:crypto');
const { Pool } = require('pg');
const { assertTestDatabase } = require('../../scripts/test-database');
const createApp = require('../../src/app');
const { createAuthModule } = require('../../src/modules/auth');
const { createPaymentReviewModule } = require('../../src/modules/payments');
const SessionBrowser = require('../helpers/session-browser');

const API = '/api/v1/payment-proofs';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV0cAAAAASUVORK5CYII=',
  'base64',
);

async function main() {
  const databaseUrl = assertTestDatabase();
  if (!process.env.BOOKINGS_QA_ROOT || !path.isAbsolute(process.env.BOOKINGS_QA_ROOT)) {
    throw new Error(
      'BOOKINGS_QA_ROOT debe identificar el snapshot absoluto del backend proveedor.',
    );
  }
  const providerRoot = process.env.BOOKINGS_QA_ROOT;
  const { migrate } = require(path.join(providerRoot, 'scripts/migrate'));
  const { createBookingsModule } = require(path.join(providerRoot, 'src/modules/bookings'));
  await migrate(databaseUrl);
  const pool = new Pool({ connectionString: databaseUrl });
  let server, directory, fileKey;
  let checks = 0;
  const checked = () => {
    checks += 1;
  };
  try {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pagos-bookings-real-'));
    fileKey = randomUUID();
    await fs.writeFile(path.join(directory, fileKey), PNG);
    const cooperative = async () =>
      (
        await pool.query('INSERT INTO cooperatives(name,ruc) VALUES($1,$2) RETURNING id', [
          'Cooperativa QA cruzada',
          randomUUID().replace(/\D/g, '').slice(0, 13).padStart(13, '7'),
        ])
      ).rows[0].id;
    const tenant = await cooperative();
    const otherTenant = await cooperative();
    const auth = await createAuthModule({
      pool,
      env: { JWT_SECRET: randomBytes(48).toString('hex') },
    });
    let now = new Date('2026-11-03T14:01:00.000Z');
    const bookings = createBookingsModule({ pool, auth, env: {}, clock: () => new Date(now) });
    const payments = createPaymentReviewModule({
      pool,
      auth,
      paymentQueries: bookings.paymentQueries,
      env: { PAYMENT_PROOF_STORAGE_DIR: directory },
    });
    server = http.createServer(createApp({ pool, auth, payments }));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const account = async (role, cooperativeId) => {
      const browser = new SessionBrowser(origin);
      const email = `qa-${randomUUID()}@qa.invalid`;
      const password = randomBytes(24).toString('hex');
      await browser.token();
      assert.equal(
        (await browser.request('/api/v1/auth/register', 'POST', { email, password })).status,
        201,
      );
      const { rows } = await pool.query(
        'UPDATE users SET role=$1,cooperative_id=$2 WHERE email=$3 RETURNING id',
        [role, role === 'CUSTOMER' ? null : cooperativeId, email],
      );
      await browser.login(email, password);
      return {
        browser,
        context: {
          userId: rows[0].id,
          role,
          cooperativeId: role === 'CUSTOMER' ? null : cooperativeId,
        },
      };
    };
    const clerk = await account('CLERK', tenant);
    const otherClerk = await account('CLERK', otherTenant);
    const owner = await account('CUSTOMER', null);
    const seed = async (cooperativeId) => {
      const bookingId = randomUUID();
      const tripId = randomUUID();
      await pool.query('INSERT INTO booking_trip_locks(cooperative_id,trip_id) VALUES($1,$2)', [
        cooperativeId,
        tripId,
      ]);
      await pool.query(
        `INSERT INTO bookings(id,cooperative_id,trip_id,owner_id,from_position,to_position,status,summary,
        base_price_cents,discount_cents,total_price_cents,created_at,expires_at,proof_window_started_at,proof_window_seconds,proof_reception_state)
        VALUES($1,$2,$3,$4,0,1,'PENDING_PAYMENT',$5,875,0,875,'2026-11-03T13:00:00Z','2026-11-03T14:05:00Z','2026-11-03T14:00:00Z',300,'NOT_RECEIVED')`,
        [
          bookingId,
          cooperativeId,
          tripId,
          owner.context.userId,
          { currency: 'USD', totals: { totalPriceCents: 875 } },
        ],
      );
      await pool.query(
        `INSERT INTO booking_seat_allocations(booking_id,cooperative_id,trip_id,seat_id,from_position,to_position,status) VALUES($1,$2,$3,'QA-1',0,1,'RESERVED')`,
        [bookingId, cooperativeId, tripId],
      );
      const { rows } = await pool.query(
        `INSERT INTO payment_proofs(booking_id,cooperative_id,status,file_key,original_file_name,media_type,file_size_bytes,uploaded_at)
        VALUES($1,$2,'UPLOADED',$3,'qa.png','image/png',$4,'2026-11-03T14:01:00Z') RETURNING id`,
        [bookingId, cooperativeId, fileKey, PNG.length],
      );
      return { bookingId, proofId: rows[0].id };
    };
    const own = await seed(tenant);
    const other = await seed(otherTenant);
    const query = { bookingId: own.bookingId, purpose: 'REVIEW_PAYMENT' };
    const read = () => bookings.paymentQueries.findForPayment(query, clerk.context);
    const initial = await read();
    assert.equal(initial.createdAt, '2026-11-03T13:00:00.000Z');
    assert.equal(initial.proofWindowStartedAt, '2026-11-03T14:00:00.000Z');
    assert.equal(initial.totalPriceCents, 875);
    assert.equal(initial.canUploadProof, true);
    assert.equal(Object.hasOwn(initial, 'ownerId'), false);
    checked();
    assert.equal(await bookings.paymentQueries.findForPayment(query, otherClerk.context), null);
    await assert.rejects(bookings.paymentQueries.findForPayment(query, owner.context), {
      code: 'FORBIDDEN',
    });
    checked();
    const before = (await pool.query('SELECT * FROM bookings WHERE id=$1', [own.bookingId])).rows;
    const seatsBefore = (
      await pool.query('SELECT * FROM booking_seat_allocations WHERE booking_id=$1', [
        own.bookingId,
      ])
    ).rows;
    for (const [instant, allowed] of [
      ['2026-11-03T14:04:59.999Z', true],
      ['2026-11-03T14:05:00.000Z', false],
      ['2026-11-03T14:05:00.001Z', false],
    ]) {
      now = new Date(instant);
      assert.equal((await read()).canUploadProof, allowed);
      checked();
    }
    assert.deepEqual(
      (await pool.query('SELECT * FROM bookings WHERE id=$1', [own.bookingId])).rows,
      before,
    );
    assert.deepEqual(
      (
        await pool.query('SELECT * FROM booking_seat_allocations WHERE booking_id=$1', [
          own.bookingId,
        ])
      ).rows,
      seatsBefore,
    );
    checked();
    let response = await clerk.browser.request(`${API}?cooperativeId=${otherTenant}&userId=ajeno`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    let page = await response.json();
    assert.equal(page.items.length, 1);
    assert.equal(page.items[0].id, own.proofId);
    assert.equal(page.items[0].totalCents, 875);
    assert.equal(Object.hasOwn(page.items[0], 'file_key'), false);
    checked();
    response = await otherClerk.browser.request(API);
    page = await response.json();
    assert.equal(page.items.length, 1);
    assert.equal(page.items[0].id, other.proofId);
    checked();
    response = await clerk.browser.request(`${API}/${own.proofId}/file`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), PNG);
    assert.equal((await clerk.browser.request(`${API}/${other.proofId}/file`)).status, 404);
    checked();
    assert.equal((await owner.browser.request(API)).status, 403);
    assert.equal((await fetch(origin + API)).status, 401);
    checked();
    // Solo fixture QA de recepción: no se invoca ni acredita una API de aceptación.
    await pool.query(
      `UPDATE bookings SET proof_reception_state='RECEIVED',accepted_proof_id=$2,proof_received_at='2026-11-03T14:01:00Z' WHERE id=$1`,
      [own.bookingId, own.proofId],
    );
    now = new Date('2026-11-03T15:00:00.000Z');
    assert.equal((await read()).canUploadProof, false);
    assert.equal((await clerk.browser.request(API)).status, 200);
    checked();
    // Inconsistencia de datos de prueba, sin modificar restricciones/esquema.
    await pool.query(
      `UPDATE bookings SET summary=jsonb_set(summary,'{totals,totalPriceCents}','999') WHERE id=$1`,
      [own.bookingId],
    );
    response = await clerk.browser.request(API);
    assert.equal(response.status, 500);
    const error = await response.json();
    assert.equal(error.error.code, 'BOOKING_DATA_INTEGRITY_ERROR');
    assert.equal(Object.hasOwn(error, 'items'), false);
    checked();
  } finally {
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    try {
      if (fileKey && directory) await fs.unlink(path.join(directory, fileKey));
      if (directory) await fs.rmdir(directory);
    } finally {
      await pool.end();
    }
  }
  process.stdout.write(
    `PAGOS/BOOKINGS REALES: ${checks} grupos de comprobaciones aprobados. Sin mutaciones productivas ni aceptación de comprobante acreditada.\n`,
  );
}
main().catch((error) => {
  process.stderr.write(`${error.name}: ${error.message}\n`);
  process.exitCode = 1;
});
