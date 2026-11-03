const { Client } = require('pg');
const {
  assertCatalog,
  migrationsDirectory,
  ignorePattern,
  MigrationSafetyError,
} = require('./migration-catalog');
const { assertHistory } = require('./migration-history');

// El runner conserva su transacción de lote; la exterior incluye su bootstrap del historial.
function transactionClient(client) {
  const boundaries = new Map([
    ['BEGIN', 'SAVEPOINT migration_batch'],
    ['COMMIT', 'RELEASE SAVEPOINT migration_batch'],
    ['ROLLBACK', 'ROLLBACK TO SAVEPOINT migration_batch'],
  ]);
  return { query: (text, ...args) => client.query(boundaries.get(text) || text, ...args) };
}

async function migrate(databaseUrl, direction = 'up') {
  if (!databaseUrl) throw new Error('DATABASE_URL es obligatorio.');
  if (!['up', 'down'].includes(direction)) throw new Error('Dirección de migración inválida.');
  await assertCatalog();
  const { runner, PG_MIGRATE_LOCK_ID } = await import('node-pg-migrate');
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    const {
      rows: [lock],
    } = await client.query('SELECT pg_try_advisory_lock($1) AS acquired', [PG_MIGRATE_LOCK_ID]);
    if (!lock.acquired)
      throw new MigrationSafetyError(
        'MIGRATION_LOCKED',
        'Otra migración está en curso. Reintente cuando termine.',
      );
    await client.query('BEGIN');
    try {
      await assertHistory(client);
      const result = await runner({
        dbClient: transactionClient(client),
        dir: migrationsDirectory,
        ignorePattern,
        direction,
        count: direction === 'down' ? 1 : Infinity,
        migrationsTable: 'pgmigrations',
        migrationsSchema: 'public',
        schema: 'public',
        checkOrder: true,
        singleTransaction: true,
        log: () => {},
      });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    // Cerrar la sesión libera también el bloqueo exterior y cualquier nivel recursivo del runner.
    await client.end();
  }
}
if (require.main === module) {
  migrate(process.env.DATABASE_URL, process.argv[2] || 'up').catch((error) => {
    const message =
      error instanceof MigrationSafetyError
        ? `${error.code}: ${error.message}`
        : 'No se pudo ejecutar la migración. Verifica conexión y esquema.';
    process.stderr.write(message + '\n');
    process.exitCode = 1;
  });
}
module.exports = { migrate, transactionClient };
