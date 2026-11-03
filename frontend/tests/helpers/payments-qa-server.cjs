// Fixtures exclusivos de PAGOS-WEB-01. Nunca se incorpora a la imagen pública.
const { randomBytes, randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('/app/node_modules/pg');
const argon2 = require('/app/node_modules/argon2');
const createApp = require('/app/src/app');
const { createAuthModule } = require('/app/src/modules/auth');
const { createPaymentsModule } = require('/app/src/modules/payments');
const { assertTestDatabase } = require('/app/scripts/test-database');

async function main() {
  assertTestDatabase();
  execFileSync(process.execPath, ['/app/scripts/migrate.js', 'up'], { stdio: 'pipe' });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const storage = '/tmp/payments-web-files';
  await fs.mkdir(storage);
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV0cAAAAASUVORK5CYII=',
    'base64',
  );
  const key = randomUUID();
  await fs.writeFile(path.join(storage, key), png);
  const auth = await createAuthModule({
    pool,
    env: { JWT_SECRET: randomBytes(48).toString('hex') },
  });
  const payments = createPaymentsModule({
    pool,
    auth,
    env: { PAYMENT_PROOF_STORAGE_DIR: storage },
  });
  const tenants = [];
  for (let i = 0; i < 3; i += 1) {
    const { rows } = await pool.query(
      'INSERT INTO cooperatives(name,ruc) VALUES($1,$2) RETURNING id',
      [`Cooperativa QA ${i + 1}`, `99999999999${i}1`],
    );
    tenants.push(rows[0].id);
  }
  const accounts = {};
  for (const [name, role, cooperativeId] of [
    ['a', 'CLERK', tenants[0]],
    ['b', 'CLERK', tenants[1]],
    ['empty', 'CLERK', tenants[2]],
    ['admin', 'COOPERATIVE_ADMIN', tenants[0]],
    ['customer', 'CUSTOMER', null],
  ]) {
    const email = `qa-${randomUUID()}@qa.invalid`;
    const password = `${randomBytes(24).toString('hex')}-QA`;
    await pool.query(
      'INSERT INTO users(email,password_hash,role,cooperative_id) VALUES($1,$2,$3,$4)',
      [email, await argon2.hash(password), role, cooperativeId],
    );
    accounts[name] = { email, password };
  }
  let otherProof;
  for (let i = 0; i < 52; i += 1) {
    const cooperativeId = i === 51 ? tenants[1] : tenants[0];
    const bookingId = randomUUID();
    const fileName =
      i === 2
        ? '<img src=x onerror=alert(1)>.png'
        : i === 1
          ? `${'nombre-largo-'.repeat(12)}.png`
          : `comprobante-QA-${String(i + 1).padStart(2, '0')}.png`;
    const { rows } = await pool.query(
      `INSERT INTO payment_proofs(booking_id,cooperative_id,status,file_key,original_file_name,media_type,file_size_bytes,uploaded_at)
      VALUES($1,$2,'UPLOADED',$3,$4,'image/png',$5,$6) RETURNING id`,
      [
        bookingId,
        cooperativeId,
        key,
        fileName,
        png.length,
        new Date(Date.UTC(2026, 10, 2, 18, 0, 0) - i * 1000),
      ],
    );
    payments.bookingReader.bookings.set(bookingId, {
      bookingId,
      cooperativeId,
      total: i === 0 ? 0 : 875,
    });
    if (i === 51) otherProof = rows[0].id;
  }
  await fs.writeFile('/tmp/payments-web-fixtures.json', JSON.stringify({ accounts, otherProof }), {
    mode: 0o600,
  });
  createApp({ auth, payments, pool }).listen(3000, '0.0.0.0', () =>
    process.stdout.write('QA_READY\n'),
  );
}
main().catch(() => {
  process.stderr.write('No se pudo preparar QA Pagos.\n');
  process.exitCode = 1;
});
