const { randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');
const { Pool } = require('pg');
const { activeNames } = require('../../../scripts/migration-catalog');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { testPool } = require('../../helpers/database');
const execute = promisify(execFile);
let admin, pool, url, name;
async function worker(action, input = {}) {
  const { stdout } = await execute(
    process.execPath,
    [path.join(__dirname, '../../helpers/migration-worker.js'), action, JSON.stringify(input)],
    { env: { ...process.env, DATABASE_URL: url } },
  );
  const result = JSON.parse(stdout);
  if (result.error)
    throw Object.assign(new Error(result.error.message), { code: result.error.code });
  return result.result;
}
async function history() {
  return (await pool.query('SELECT name FROM pgmigrations ORDER BY id')).rows.map((r) => r.name);
}
beforeAll(async () => {
  const target = new URL(assertTestDatabase());
  admin = testPool();
  name = 'benefit_requests_' + randomUUID().replaceAll('-', '') + '_test';
  await admin.query('CREATE DATABASE ' + name);
  target.pathname = '/' + name;
  url = target.href;
  pool = new Pool({ connectionString: url });
});
afterAll(async () => {
  try {
    await pool?.end();
    if (name) {
      if (!/^benefit_requests_[a-f0-9]{32}_test$/.test(name)) throw new Error('Base QA inválida');
      await admin.query('DROP DATABASE ' + name);
    }
  } finally {
    await admin?.end();
  }
});
test('aplica desde develop conservando reservas anteriores y solo añade la tabla propia', async () => {
  const target = activeNames.indexOf('1794320000000-booking-benefit-requests');
  expect(target).toBeGreaterThan(0);
  await worker('raw', { names: activeNames.slice(0, target) });
  await pool.query("INSERT INTO booking_trip_locks VALUES('cooperativa-qa','viaje-qa')");
  await pool.query(`INSERT INTO bookings(id,cooperative_id,trip_id,owner_id,from_position,to_position,status,summary,
    base_price_cents,discount_cents,total_price_cents,created_at,expires_at,proof_reception_state)
    VALUES('reserva-qa','cooperativa-qa','viaje-qa','cliente-qa',0,1,'PENDING_PAYMENT','{}',
    1000,0,1000,'2026-11-04T14:00:00Z','2026-11-04T14:05:00Z','UNKNOWN')`);
  const before = (await pool.query('SELECT * FROM bookings')).rows;
  await worker('migrate', { direction: 'up' });
  expect(await history()).toEqual(activeNames);
  expect((await pool.query('SELECT * FROM bookings')).rows).toEqual(before);
  expect((await pool.query('SELECT * FROM booking_benefit_requests')).rows).toEqual([]);
});
test('tabla vacía se revierte y reaplica sin alterar las filas existentes', async () => {
  const before = (await pool.query('SELECT * FROM bookings')).rows;
  const target = activeNames.indexOf('1794320000000-booking-benefit-requests');
  while ((await history()).at(-1) !== activeNames[target - 1])
    await worker('migrate', { direction: 'down' });
  expect(await history()).toEqual(activeNames.slice(0, target));
  expect(
    (await pool.query("SELECT to_regclass('public.booking_benefit_requests') AS name")).rows[0]
      .name,
  ).toBeNull();
  await worker('migrate', { direction: 'up' });
  expect((await pool.query('SELECT * FROM bookings')).rows).toEqual(before);
  expect(await history()).toEqual(activeNames);
});
test('down con solicitudes falla sin borrar filas ni cambiar historia o esquema', async () => {
  const target = activeNames.indexOf('1794320000000-booking-benefit-requests');
  while ((await history()).at(-1) !== activeNames[target])
    await worker('migrate', { direction: 'down' });
  await pool.query(
    `INSERT INTO booking_benefit_requests(id,owner_id,cooperative_id,trip_id,request_key,fingerprint,
    from_position,to_position,purchase,journey,created_at,expires_at)
    VALUES($1,$2,$3,$4,'migration-request-qa',$5,0,1,$6,$7,'2026-11-04T14:00:00Z','2030-01-01T12:00:00Z')`,
    [
      randomUUID(),
      randomUUID(),
      randomUUID(),
      randomUUID(),
      'a'.repeat(64),
      { passengers: [{ seatId: 'qa' }] },
      { fromPlace: 'Ambato', toPlace: 'Quito' },
    ],
  );
  const before = (await pool.query('SELECT * FROM booking_benefit_requests')).rows;
  await expect(worker('migrate', { direction: 'down' })).rejects.toThrow(
    'Las solicitudes de acreditación requieren un plan',
  );
  expect((await pool.query('SELECT * FROM booking_benefit_requests')).rows).toEqual(before);
  expect(await history()).toEqual(activeNames.slice(0, target + 1));
});
