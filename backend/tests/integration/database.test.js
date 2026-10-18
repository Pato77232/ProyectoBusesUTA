const {readdirSync}=require('node:fs');
const path=require('node:path');
const {runMigration,testPool}=require('../helpers/database');
let pool;
const migrationNames=readdirSync(path.join(__dirname,'../../migrations')).filter(name=>/^\d+.*\.js$/.test(name)).map(name=>name.replace(/\.js$/,'')).sort();
beforeAll(()=>{runMigration();pool=testPool();});
afterAll(async()=>{if(pool)await pool.end();});
test('migraciones reversibles y reaplicación sin duplicados en PostgreSQL',async()=>{
  expect(migrationNames.length).toBeGreaterThanOrEqual(2);
  const before=await pool.query('SELECT name FROM pgmigrations ORDER BY name');
  expect(before.rows.map(row=>row.name)).toEqual(migrationNames);
  for(const name of [...migrationNames].reverse()) {
    const current=await pool.query('SELECT name FROM pgmigrations ORDER BY name DESC LIMIT 1');
    expect(current.rows[0].name).toBe(name);
    runMigration('down');
  }
  const result=await pool.query("SELECT to_regclass('infrastructure_checks') AS table_name");
  expect(result.rows[0].table_name).toBeNull();
  expect((await pool.query('SELECT * FROM pgmigrations')).rows).toHaveLength(0);
  runMigration();runMigration();
  const migrated=await pool.query('SELECT name FROM pgmigrations ORDER BY name');
  expect(migrated.rows.map(row=>row.name)).toEqual(migrationNames);
  expect(new Set(migrated.rows.map(row=>row.name)).size).toBe(migrationNames.length);
});
