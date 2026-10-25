const createApp = require('./app');
const logger = require('./shared/logger');
const { createPool } = require('./shared/database');
const { createAuthModule } = require('./modules/auth');
const { createTenantsModule } = require('./modules/tenants');
const { createFleetModule } = require('./modules/fleet');
async function start(env = process.env) {
  const port = env.PORT === undefined ? 3000 : Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválido.');
  const pool = createPool(env.DATABASE_URL);
  let server;
  try {
    await pool.query('SELECT 1');
    const auth = await createAuthModule({ pool, env });
    const tenants = createTenantsModule({ pool, auth });
    const fleet = createFleetModule({ pool, auth });
    const app = createApp({ auth, tenants, fleet, pool, trustProxy: env.TRUST_PROXY === 'loopback' });
    server = await new Promise((resolve, reject) => {
      const listener = app.listen(port, () => resolve(listener));
      listener.once('error', reject);
    });
    logger.info({ port }, 'Servidor iniciado');
  } catch (error) {
    await pool.end();
    throw error;
  }
  const close = () => server.close(() => pool.end());
  process.once('SIGTERM', close);
  process.once('SIGINT', close);
  return { server, pool };
}
if (require.main === module) {
  start().catch(() => {
    logger.error('No se pudo iniciar el servidor. Verifica configuración y base de datos.');
    process.exitCode = 1;
  });
}
module.exports = { start };
