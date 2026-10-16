const {runMigration,testPool} = require('../helpers/database');
let pool;
beforeAll(() => { runMigration(); pool=testPool(); });
afterAll(async () => { if(pool) await pool.end(); });
test('migraciones reversibles y reaplicación sin duplicados en PostgreSQL',async () => {
  runMigration('down');
  runMigration('down');
  const result = await pool.query("SELECT to_regclass('infrastructure_checks') AS table_name");
  expect(result.rows[0].table_name).toBeNull();
  runMigration(); runMigration();
  const migrated = await pool.query('SELECT count(*)::int AS count FROM pgmigrations');
  expect(migrated.rows[0].count).toBe(2);
});
