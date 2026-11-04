const { runMigration } = require('./database');
const { assertTestDatabase } = require('../../scripts/test-database');

// Deja como última la migración cuyo down se quiere comprobar.
async function rollbackBefore(pool, target) {
  assertTestDatabase();
  const { rows } = await pool.query('SELECT name FROM pgmigrations ORDER BY id DESC');
  const position = rows.findIndex(({ name }) => name === target);
  if (position < 0) throw new Error(`Migración de prueba no aplicada: ${target}`);
  for (const { name } of rows.slice(0, position)) {
    const current = await pool.query('SELECT name FROM pgmigrations ORDER BY id DESC LIMIT 1');
    expect(current.rows[0].name).toBe(name);
    runMigration('down');
  }
  const current = await pool.query('SELECT name FROM pgmigrations ORDER BY id DESC LIMIT 1');
  expect(current.rows[0].name).toBe(target);
}

module.exports = { rollbackBefore };
