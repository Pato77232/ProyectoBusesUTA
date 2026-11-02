const { Pool } = require('pg');
const { inspectFleetPhotoOperation } = require('../src/modules/fleet');

async function main() {
  const [busId, operationId, cooperativeId, ...extra] = process.argv.slice(2);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  if (extra.length || ![busId, operationId, cooperativeId].every((id) => uuid.test(id || '')))
    throw new Error(
      'Uso: node scripts/inspect-fleet-photo-operation.js BUS_UUID OPERACION_UUID COOPERATIVA_UUID',
    );
  if (!process.env.DATABASE_URL || !process.env.BUS_PHOTO_STORAGE_DIR)
    throw new Error('Configura DATABASE_URL y BUS_PHOTO_STORAGE_DIR para soporte.');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const report = await inspectFleetPhotoOperation({
      pool,
      root: process.env.BUS_PHOTO_STORAGE_DIR,
      busId,
      operationId,
      cooperativeId,
    });
    process.stdout.write(`${JSON.stringify(report)}\n`);
  } finally {
    await pool.end();
  }
}

main().catch(() => {
  // No imprimir errores de pg/fs: pueden contener URL, rutas privadas o SQL.
  process.stderr.write(
    'No se pudo inspeccionar la operación. Comprueba argumentos, configuración y acceso de soporte.\n',
  );
  process.exitCode = 1;
});
