// Harness QA: ejecutar el migrador ESM con Node real, fuera del VM de Jest.
const path = require('node:path');
const { assertTestDatabase } = require('../../scripts/test-database');
const { migrate } = require('../../scripts/migrate');
const { migrationsDirectory } = require('../../scripts/migration-catalog');

async function run() {
  const databaseUrl = assertTestDatabase();
  const action = process.argv[2];
  const input = JSON.parse(process.argv[3] || '{}');
  if (action === 'migrate') return migrate(databaseUrl, input.direction);
  const { runner, PG_MIGRATE_LOCK_ID } = await import('node-pg-migrate');
  if (action === 'lockId') return PG_MIGRATE_LOCK_ID;
  const directory =
    action === 'raw'
      ? input.names.map((name) =>
          path.join(migrationsDirectory, name + '.js').replaceAll('\\', '/'),
        )
      : input.directory;
  if (!['raw', 'fixture'].includes(action)) throw new Error('Acción QA inválida.');
  return runner({
    databaseUrl,
    dir: directory,
    useGlob: action === 'raw',
    ignorePattern: action === 'raw' ? '**/.*' : undefined,
    direction: 'up',
    migrationsTable: 'pgmigrations',
    singleTransaction: true,
    checkOrder: true,
    log: () => {},
  });
}
run()
  .then((result) => process.stdout.write(JSON.stringify({ result })))
  .catch((error) =>
    process.stdout.write(JSON.stringify({ error: { code: error.code, message: error.message } })),
  );
