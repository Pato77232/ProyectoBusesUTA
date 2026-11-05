const { randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');
const { Pool } = require('pg');
const { activeNames } = require('../../../scripts/migration-catalog');
const { assertTestDatabase } = require('../../../scripts/test-database');
const { testPool } = require('../../helpers/database');
const execute = promisify(execFile);
let admin, pool, url, name, id;
async function worker(action, input = {}) {
  const { stdout } = await execute(
    process.execPath,
    [path.join(__dirname, '../../helpers/migration-worker.js'), action, JSON.stringify(input)],
    { env: { ...process.env, DATABASE_URL: url } },
  );
  const result = JSON.parse(stdout);
  if (result.error) throw new Error(result.error.message);
  return result.result;
}
const history = async () =>
  (await pool.query('SELECT name FROM pgmigrations ORDER BY id')).rows.map((r) => r.name);
beforeAll(async () => {
  const target = new URL(assertTestDatabase());
  admin = testPool();
  name = 'benefit_review_' + randomUUID().replaceAll('-', '') + '_test';
  await admin.query('CREATE DATABASE ' + name);
  target.pathname = '/' + name;
  url = target.href;
  pool = new Pool({ connectionString: url });
});
afterAll(async () => {
  try {
    await pool?.end();
    if (name) {
      if (!/^benefit_review_[a-f0-9]{32}_test$/.test(name)) throw new Error('Base QA inválida');
      await admin.query('DROP DATABASE ' + name);
    }
  } finally {
    await admin?.end();
  }
});
test('actualiza solicitudes B sin cambiar sus datos y mantiene historial ordenado', async () => {
  const target = activeNames.indexOf('1794330000000-booking-benefit-request-reviews');
  expect(target).toBeGreaterThan(0);
  await worker('raw', { names: activeNames.slice(0, target) });
  id = randomUUID();
  await pool.query(
    `INSERT INTO booking_benefit_requests(id,owner_id,cooperative_id,trip_id,request_key,fingerprint,from_position,to_position,purchase,journey,created_at,expires_at)
 VALUES($1,$2,$3,$4,'migration-review-qa',$5,0,1,$6,$7,'2026-11-04T14:00:00Z','2030-01-01T12:00:00Z')`,
    [
      id,
      randomUUID(),
      randomUUID(),
      randomUUID(),
      'a'.repeat(64),
      { passengers: [{ seatId: 'qa' }] },
      { fromPlace: 'Ambato', toPlace: 'Quito' },
    ],
  );
  const before = (await pool.query('SELECT * FROM booking_benefit_requests')).rows[0];
  await worker('migrate', { direction: 'up' });
  const after = (await pool.query('SELECT * FROM booking_benefit_requests')).rows[0];
  expect(Object.fromEntries(Object.keys(before).map((key) => [key, after[key]]))).toEqual(before);
  expect(after.reviewed_at).toBeNull();
  expect(after.review_decisions).toBeNull();
  expect(await history()).toEqual(activeNames);
});
test('revierte y reaplica con solicitudes pendientes conservando su contenido', async () => {
  const before = (
    await pool.query(
      'SELECT id,purchase,status,revision,created_at,expires_at FROM booking_benefit_requests',
    )
  ).rows;
  await worker('migrate', { direction: 'down' });
  expect(await history()).toEqual(activeNames.slice(0, -1));
  expect(
    (
      await pool.query(
        'SELECT id,purchase,status,revision,created_at,expires_at FROM booking_benefit_requests',
      )
    ).rows,
  ).toEqual(before);
  await worker('migrate', { direction: 'up' });
  expect(await history()).toEqual(activeNames);
});
test('resultado con evidencia impide down sin borrar solicitud, acreditación o historia', async () => {
  const row = (await pool.query('SELECT * FROM booking_benefit_requests')).rows[0];
  const actor = randomUUID();
  const decisions = [
    {
      seatId: 'qa',
      birthDateVerified: true,
      disabilityVerified: false,
      evidence: [{ kind: 'IDENTITY', reference: 'ref_identity_0001' }],
    },
  ];
  const source = await pool.query(
    `INSERT INTO booking_benefit_reviews(cooperative_id,reviewed_by,context_hash,decisions,reviewed_at,expires_at)
 VALUES($1,$2,$3,$4,'2026-11-04T14:01:00Z',$5) RETURNING id`,
    [
      row.cooperative_id,
      actor,
      'b'.repeat(64),
      JSON.stringify([{ seatId: 'qa', birthDateVerified: true, disabilityVerified: false }]),
      row.expires_at,
    ],
  );
  await pool.query(
    `UPDATE booking_benefit_requests SET status='REVIEWED',revision=2,reviewed_at='2026-11-04T14:01:00Z',
 reviewed_by=$2,review_fingerprint=$3,review_expected_revision=1,review_decisions=$4,benefit_review_id=$5 WHERE id=$1`,
    [id, actor, 'c'.repeat(64), JSON.stringify(decisions), source.rows[0].id],
  );
  const before = (await pool.query('SELECT * FROM booking_benefit_requests')).rows;
  const reviews = (await pool.query('SELECT * FROM booking_benefit_reviews')).rows;
  await expect(worker('migrate', { direction: 'down' })).rejects.toThrow(
    'Las revisiones requieren un plan',
  );
  expect((await pool.query('SELECT * FROM booking_benefit_requests')).rows).toEqual(before);
  expect((await pool.query('SELECT * FROM booking_benefit_reviews')).rows).toEqual(reviews);
  expect(await history()).toEqual(activeNames);
});
