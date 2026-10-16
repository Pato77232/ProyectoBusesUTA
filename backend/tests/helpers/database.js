const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { assertTestDatabase } = require('../../scripts/test-database');
const { createPool } = require('../../src/shared/database');
function runMigration(direction = 'up') {
  assertTestDatabase();
  execFileSync(process.execPath,[path.join(__dirname,'../../scripts/migrate.js'),direction],{env:process.env,stdio:'pipe'});
}
function testPool() { return createPool(assertTestDatabase()); }
async function clearAuth(pool) {
  assertTestDatabase();
  await pool.query('TRUNCATE auth_sessions, users');
}
module.exports = {runMigration,testPool,clearAuth};
