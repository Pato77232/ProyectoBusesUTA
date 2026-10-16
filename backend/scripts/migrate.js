const path = require('node:path');
async function migrate(databaseUrl, direction = 'up') {
  if (!databaseUrl) throw new Error('DATABASE_URL es obligatorio.');
  if (!['up', 'down'].includes(direction)) throw new Error('Dirección de migración inválida.');
  const { runner } = await import('node-pg-migrate');
  return runner({
    databaseUrl,
    dir: path.join(__dirname, '../migrations'),
    direction,
    count: direction === 'down' ? 1 : Infinity,
    migrationsTable: 'pgmigrations',
    log: () => {},
  });
}
if (require.main === module) {
  migrate(process.env.DATABASE_URL, process.argv[2] || 'up').catch(() => {
    process.stderr.write('No se pudo ejecutar la migración. Verifica conexión y esquema.\n');
    process.exitCode = 1;
  });
}
module.exports = { migrate };
