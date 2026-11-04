const createApp = require('./app');
const logger = require('./shared/logger');
const { createPool } = require('./shared/database');
const { createAuthModule } = require('./modules/auth');
const { createTenantsModule } = require('./modules/tenants');
const { createFleetModule } = require('./modules/fleet');
const { createFrequenciesModule } = require('./modules/frequencies');
const {
  createRouteSheetsModule,
  createFrequencyCommitmentQueries,
} = require('./modules/route-sheets');
const {
  createPaymentsModule,
  createPaymentReceiptModule,
  createPaymentReviewModule,
} = require('./modules/payments');
const { createBookingsModule, createBookingOccupancyQueries } = require('./modules/bookings');
function closeServer(server) {
  return new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
async function start(env = process.env) {
  const port = env.PORT === undefined ? 3000 : Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválido.');
  const pool = createPool(env.DATABASE_URL);
  let server;
  let expirationWorker;
  let expirationStopped;
  const stopExpiration = () => {
    if (!expirationStopped) {
      try {
        expirationStopped = Promise.resolve(expirationWorker?.stop());
      } catch (error) {
        expirationStopped = Promise.reject(error);
      }
    }
    return expirationStopped;
  };
  try {
    await pool.query('SELECT 1');
    const auth = await createAuthModule({ pool, env });
    const tenants = createTenantsModule({ pool, auth });
    const fleet = createFleetModule({ pool, auth, env });
    const occupancyQueries = createBookingOccupancyQueries({ pool });
    const frequencies = createFrequenciesModule({
      pool,
      auth,
      commitmentQueries: createFrequencyCommitmentQueries({ occupancyQueries }),
    });
    const routeSheets = createRouteSheetsModule({
      pool,
      auth,
      frequencyQueries: frequencies.frequencyQueries,
      busGroupQueries: fleet.busGroupQueries,
      busQueries: fleet.busQueries,
      seatQueries: fleet.seatQueries,
      occupancyQueries,
    });
    if (typeof routeSheets.tripQueries?.findBookableForSegment !== 'function')
      throw new Error('No se pudo conectar el catálogo de viajes por tramo.');
    const bookings = createBookingsModule({
      pool,
      auth,
      env,
      availabilityQueries: routeSheets.tripQueries,
    });
    const paymentReceipt = createPaymentReceiptModule({
      pool,
      createPaymentProofReceiver: bookings.createPaymentProofReceiver,
    });
    const payments = createPaymentsModule({
      pool,
      auth,
      env,
      paymentQueries: bookings.paymentQueries,
      bookingPaymentProofNotifier: paymentReceipt.bookingPaymentProofNotifier,
    });
    const paymentReview = createPaymentReviewModule({
      pool,
      auth,
      paymentQueries: bookings.paymentQueries,
      env,
    });
    const app = createApp({
      auth,
      tenants,
      fleet,
      frequencies,
      routeSheets,
      paymentReview,
      payments,
      bookings,
      pool,
      trustProxy: env.TRUST_PROXY === 'loopback',
    });
    server = await new Promise((resolve, reject) => {
      const listener = app.listen(port, () => resolve(listener));
      listener.once('error', reject);
    });
    expirationWorker = bookings.maintenance.startExpirationWorker({
      onFailure: (failure) =>
        logger.error(failure, 'No se pudo completar la expiración de reservas.'),
    });
    logger.info({ port }, 'Servidor iniciado');
  } catch (error) {
    await Promise.allSettled([stopExpiration(), server ? closeServer(server) : Promise.resolve()]);
    await pool.end();
    throw error;
  }
  let closing;
  const stop = () => {
    if (!closing) {
      const stopping = stopExpiration();
      closing = (async () => {
        try {
          const results = await Promise.allSettled([closeServer(server), stopping]);
          const failure = results.find((result) => result.status === 'rejected');
          if (failure) throw failure.reason;
        } finally {
          await pool.end();
        }
      })();
    }
    return closing;
  };
  const onSignal = () =>
    stop().catch(() => logger.error('No se pudo cerrar el servidor ordenadamente.'));
  process.once('SIGTERM', onSignal);
  process.once('SIGINT', onSignal);
  server.once('close', () => {
    process.removeListener('SIGTERM', onSignal);
    process.removeListener('SIGINT', onSignal);
    void stopExpiration().catch(() => logger.error('No se pudo detener la expiración.'));
  });
  return { server, pool, stop };
}
if (require.main === module) {
  start().catch(() => {
    logger.error('No se pudo iniciar el servidor. Verifica configuración y base de datos.');
    process.exitCode = 1;
  });
}
module.exports = { start };
