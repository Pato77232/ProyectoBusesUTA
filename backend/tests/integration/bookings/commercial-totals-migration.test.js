const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { Pool } = require('pg');
const { activeNames } = require('../../../scripts/migration-catalog');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { testPool } = require('../../helpers/database');
const databaseName = 'commercial_upgrade_' + randomUUID().replaceAll('-', '') + '_test';
let admin,
  pool,
  databaseUrl,
  created = false;
function worker(action, input) {
  const output = execFileSync(
    process.execPath,
    [path.join(__dirname, '../../helpers/migration-worker.js'), action, JSON.stringify(input)],
    { env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: 'utf8' },
  );
  const result = JSON.parse(output);
  if (result.error) throw new Error(result.error.message);
  return result.result;
}
beforeAll(async () => {
  const url = new URL(assertTestDatabase());
  admin = testPool();
  await admin.query('CREATE DATABASE ' + databaseName);
  created = true;
  url.pathname = '/' + databaseName;
  databaseUrl = url.href;
  pool = new Pool({ connectionString: databaseUrl });
});
afterAll(async () => {
  try {
    await pool?.end();
    if (created) {
      if (!/^commercial_upgrade_[a-f0-9]{32}_test$/.test(databaseName))
        throw new Error('Base QA inválida.');
      await admin.query('DROP DATABASE ' + databaseName);
    }
  } finally {
    await admin?.end();
  }
});
test('actualiza las migraciones anteriores a totales comerciales, conserva reserva y ocupación y permite down/up', async () => {
  const target = activeNames.indexOf('1794250000000-booking-commercial-totals');
  expect(target).toBeGreaterThan(0);
  worker('raw', { names: activeNames.slice(0, target) });
  await pool.query("INSERT INTO booking_trip_locks VALUES('cooperativa-legada','viaje-legado')");
  await pool.query(`INSERT INTO bookings(id,cooperative_id,trip_id,owner_id,from_position,to_position,status,summary,
    base_price_cents,discount_cents,total_price_cents,created_at,expires_at,proof_reception_state)
    VALUES('reserva-legada','cooperativa-legada','viaje-legado','cliente-legado',0,1,'PENDING_PAYMENT',
    '{"totals":{"basePriceCents":400,"discountCents":101,"totalPriceCents":299}}',400,101,299,
    '2026-11-03T14:00:00Z','2026-11-03T14:05:00Z','UNKNOWN')`);
  await pool.query(
    "INSERT INTO booking_seat_allocations VALUES('reserva-legada','cooperativa-legada','viaje-legado','asiento-legado',0,1,'RESERVED',true)",
  );
  const columns =
    'id,summary,base_price_cents,discount_cents,total_price_cents,created_at,expires_at,proof_reception_state';
  const before = (await pool.query(`SELECT ${columns} FROM bookings`)).rows;
  const allocations = (await pool.query('SELECT * FROM booking_seat_allocations')).rows;
  worker('migrate', { direction: 'up' });
  expect((await pool.query(`SELECT ${columns} FROM bookings`)).rows).toEqual(before);
  expect((await pool.query('SELECT * FROM booking_seat_allocations')).rows).toEqual(allocations);
  expect(
    (await pool.query('SELECT vip_surcharge_cents,rounding_adjustment_cents FROM bookings'))
      .rows[0],
  ).toEqual({ vip_surcharge_cents: '0', rounding_adjustment_cents: '0' });
  while (
    (await pool.query('SELECT name FROM pgmigrations ORDER BY id DESC LIMIT 1')).rows[0].name !==
    activeNames[target]
  ) {
    worker('migrate', { direction: 'down' });
  }
  worker('migrate', { direction: 'down' });
  expect((await pool.query(`SELECT ${columns} FROM bookings`)).rows).toEqual(before);
  expect(
    (await pool.query('SELECT name FROM pgmigrations ORDER BY id')).rows.map((row) => row.name),
  ).toEqual(activeNames.slice(0, target));
  worker('migrate', { direction: 'up' });
  expect((await pool.query(`SELECT ${columns} FROM bookings`)).rows).toEqual(before);
});
test('acreditaciones conserva auditoría e historial al rechazar down con datos', async () => {
  while (
    (await pool.query('SELECT name FROM pgmigrations ORDER BY id DESC LIMIT 1')).rows[0].name !==
    '1794260000000-booking-benefit-reviews'
  ) {
    worker('migrate', { direction: 'down' });
  }
  const before = (await pool.query('SELECT name FROM pgmigrations ORDER BY id')).rows;
  await pool.query(
    `INSERT INTO booking_benefit_reviews
    (cooperative_id,reviewed_by,context_hash,decisions,reviewed_at,expires_at)
    VALUES($1,$2,$3,'[]','2030-01-01T10:00Z','2030-01-01T11:00Z')`,
    [randomUUID(), randomUUID(), 'a'.repeat(64)],
  );
  const records = (await pool.query('SELECT * FROM booking_benefit_reviews')).rows;
  expect(() => worker('migrate', { direction: 'down' })).toThrow(
    'Las acreditaciones requieren un plan',
  );
  expect((await pool.query('SELECT name FROM pgmigrations ORDER BY id')).rows).toEqual(before);
  expect((await pool.query('SELECT * FROM booking_benefit_reviews')).rows).toEqual(records);
});
