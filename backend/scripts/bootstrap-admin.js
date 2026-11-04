const { createPool } = require('../src/shared/database');
const { bootstrapSystemAdmin } = require('../src/modules/auth');
const readCredentials = require('./bootstrap-admin-input');
async function main() {
  let pool;
  try {
    const credentials = await readCredentials();
    pool = createPool();
    const result = await bootstrapSystemAdmin({ pool, credentials });
    process.stdout.write(
      result.created
        ? 'Administrador inicial creado.\n'
        : 'Ya existe un administrador del sistema; no se modificaron cuentas.\n',
    );
  } catch {
    process.stderr.write(
      'No se pudo inicializar el administrador. Verifica los datos, la conexión, las migraciones y que el email esté disponible.\n',
    );
    process.exitCode = 1;
  } finally {
    if (pool) {
      try {
        await pool.end();
      } catch {
        process.stderr.write('No se pudo cerrar la conexión de inicialización.\n');
        process.exitCode = 1;
      }
    }
  }
}
if (require.main === module) main();
module.exports = main;
