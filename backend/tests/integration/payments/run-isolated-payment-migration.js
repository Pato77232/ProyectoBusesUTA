async function runMigration() {
  const [direction, schema, directory] = process.argv.slice(2);
  if (!['up', 'down'].includes(direction) || !schema || !directory) {
    throw new Error('Argumentos de migración de pagos inválidos.');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL es obligatorio.');
  }

  const { runner } = await import('node-pg-migrate');
  await runner({
    databaseUrl: process.env.DATABASE_URL,
    dir: directory,
    direction,
    count: direction === 'down' ? 1 : Infinity,
    migrationsTable: 'pgmigrations',
    schema,
    log: () => {},
  });
}

runMigration().catch(() => {
  process.stderr.write('No se pudo ejecutar la migración aislada de pagos.\n');
  process.exitCode = 1;
});
