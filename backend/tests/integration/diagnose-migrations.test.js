const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { Pool } = require('pg');
const { activeNames } = require('../../scripts/migration-catalog');
const { assertTestDatabase } = require('../../scripts/test-database');
const name = 'diagnostic_' + randomUUID().replaceAll('-', '') + '_test';
let admin,
  pool,
  url,
  created = false;

function command(...args) {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, '../../scripts/diagnose-migrations.js'), ...args],
    {
      env: { ...process.env, DATABASE_URL: url },
      encoding: 'utf8',
    },
  );
  if (result.error) throw result.error;
  return { status: result.status, report: JSON.parse(result.stdout) };
}

beforeAll(async () => {
  const database = new URL(assertTestDatabase());
  admin = new Pool({ connectionString: database.href });
  await admin.query('CREATE DATABASE ' + name);
  created = true;
  database.pathname = '/' + name;
  url = database.href;
  pool = new Pool({ connectionString: url });
});

afterAll(async () => {
  try {
    await pool?.end();
    if (created) {
      if (!/^diagnostic_[a-f0-9]{32}_test$/.test(name)) throw new Error('Base QA inválida.');
      await admin.query('DROP DATABASE ' + name);
    }
  } finally {
    await admin?.end();
  }
});

test('CLI real consulta base vacía y completa up/down/up preservando el catálogo', () => {
  expect(command('status')).toMatchObject({
    status: 0,
    report: { ok: true, applied: [], steps: [] },
  });
  expect(command('up')).toMatchObject({ status: 0, report: { ok: true, applied: activeNames } });
  const down = command('down', activeNames.at(-2));
  expect(down.status).toBe(0);
  expect(down.report.steps.map((step) => step.migration)).toEqual(activeNames.slice(-2).reverse());
  expect(down.report.applied).toEqual(activeNames.slice(0, -2));
  expect(command('up')).toMatchObject({ status: 0, report: { ok: true, applied: activeNames } });
});

test('CLI identifica un rechazo protector sin borrar acreditaciones ni saltar la migración', async () => {
  expect(command('up').status).toBe(0);
  await pool.query(
    `INSERT INTO booking_benefit_reviews
    (cooperative_id,reviewed_by,context_hash,decisions,reviewed_at,expires_at)
    VALUES($1,$2,$3,'[]','2030-01-01T10:00Z','2030-01-01T11:00Z')`,
    [randomUUID(), randomUUID(), 'a'.repeat(64)],
  );
  const before = (await pool.query('SELECT * FROM booking_benefit_reviews')).rows;
  const target = '1794260000000-booking-benefit-reviews';
  const { status, report } = command('down', target);
  expect(status).toBe(1);
  expect(report).toMatchObject({ ok: false, stage: 'down', error: { code: 'P0001' } });
  expect(report.steps.at(-1)).toMatchObject({ migration: target, ok: false });
  expect(report.steps.slice(0, -1).every((step) => step.ok)).toBe(true);
  expect((await pool.query('SELECT * FROM booking_benefit_reviews')).rows).toEqual(before);
  expect(
    (await pool.query('SELECT name FROM pgmigrations ORDER BY id DESC LIMIT 1')).rows[0].name,
  ).toBe(target);
  expect(JSON.stringify(report)).not.toContain(url);
  expect(command('up')).toMatchObject({ status: 0, report: { ok: true, applied: activeNames } });
  expect((await pool.query('SELECT * FROM booking_benefit_reviews')).rows).toEqual(before);
});
