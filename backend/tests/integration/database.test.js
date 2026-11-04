const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { Pool } = require('pg');
const { activeNames } = require('../../scripts/migration-catalog');
const { assertTestDatabase } = require('../../scripts/test-database');
const { testPool } = require('../helpers/database');
let pool, admin, databaseUrl;
let created = false;
const databaseName = 'migration_cycle_' + randomUUID().replaceAll('-', '') + '_test';
const migrationNames = [...activeNames];
// La reversión de toda la cadena se comprueba en una base vacía propia, no sobre los datos de otras suites.
function runMigration(direction = 'up') {
  execFileSync(process.execPath, [path.join(__dirname, '../../scripts/migrate.js'), direction], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}
beforeAll(async () => {
  const url = new URL(assertTestDatabase());
  admin = testPool();
  await admin.query('CREATE DATABASE ' + databaseName);
  created = true;
  url.pathname = '/' + databaseName;
  databaseUrl = url.href;
  pool = new Pool({ connectionString: databaseUrl });
  runMigration();
});
afterAll(async () => {
  try {
    if (pool) await pool.end();
    if (created) {
      if (!/^migration_cycle_[a-f0-9]{32}_test$/.test(databaseName))
        throw new Error('Base QA inválida.');
      await admin.query('DROP DATABASE ' + databaseName);
    }
  } finally {
    if (admin) await admin.end();
  }
});
test('migraciones reversibles y reaplicación sin duplicados en PostgreSQL', async () => {
  expect(migrationNames.length).toBeGreaterThanOrEqual(2);
  const before = await pool.query('SELECT name FROM pgmigrations ORDER BY name');
  expect(before.rows.map((row) => row.name)).toEqual(migrationNames);
  for (const name of [...migrationNames].reverse()) {
    const current = await pool.query('SELECT name FROM pgmigrations ORDER BY name DESC LIMIT 1');
    expect(current.rows[0].name).toBe(name);
    runMigration('down');
  }
  const result = await pool.query("SELECT to_regclass('infrastructure_checks') AS table_name");
  expect(result.rows[0].table_name).toBeNull();
  expect((await pool.query('SELECT * FROM pgmigrations')).rows).toHaveLength(0);
  runMigration();
  runMigration();
  const migrated = await pool.query('SELECT name FROM pgmigrations ORDER BY name');
  expect(migrated.rows.map((row) => row.name)).toEqual(migrationNames);
  expect(new Set(migrated.rows.map((row) => row.name)).size).toBe(migrationNames.length);
});
