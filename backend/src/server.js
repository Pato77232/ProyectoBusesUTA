const createApp = require('./app');
const logger = require('./shared/logger');
const { createPool } = require('./shared/database');
const { createAuthModule, createCustomerContactQueries } = require('./modules/auth');
const { createTenantsModule, createPublicCooperativeQueries } = require('./modules/tenants');
const { createSearchModule } = require('./modules/search');
const { createFleetModule } = require('./modules/fleet');
const { createFrequenciesModule } = require('./modules/frequencies');
const {
  createRouteSheetsModule,
  createFrequencyCommitmentQueries,
  createPublicTripSearch,
} = require('./modules/route-sheets');
const {
  createPaymentsModule,
  createPaymentReceiptModule,
  createPaymentReviewModule,
} = require('./modules/payments');
const {
  createBookingsModule,
  createBookingOccupancyQueries,
  createBookingTicketQueries,
  createBookingNotificationQueries,
} = require('./modules/bookings');
const { createTicketsModule } = require('./modules/tickets');
const { createNotificationsModule } = require('./modules/notifications');
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
  let passwordResetWorker;
  let passwordResetStopped;
  let notificationWorker;
  let notificationStopped;
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
  const stopPasswordReset = () => {
    if (!passwordResetStopped) {
      try {
        passwordResetStopped = Promise.resolve(passwordResetWorker?.stop());
      } catch (error) {
        passwordResetStopped = Promise.reject(error);
      }
    }
    return passwordResetStopped;
  };
  const stopNotifications = () => {
    if (!notificationStopped) {
      try {
        notificationStopped = Promise.resolve(notificationWorker?.stop());
      } catch (error) {
        notificationStopped = Promise.reject(error);
      }
    }
    return notificationStopped;
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
    const notifications = createNotificationsModule({
      pool,
      env,
      bookingContexts: createBookingNotificationQueries({ pool }),
      customerContacts: createCustomerContactQueries({ pool }),
    });
    const bookings = createBookingsModule({
      pool,
      auth,
      env,
      availabilityQueries: routeSheets.tripQueries,
      notificationOutbox: notifications.outbox,
    });
    const search = createSearchModule({
      tripSearch: createPublicTripSearch({ pool, tripQueries: routeSheets.tripQueries }),
      cooperativeQueries: createPublicCooperativeQueries({ pool }),
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
      bookingSaleConfirmer: bookings.saleConfirmer,
      notificationOutbox: notifications.outbox,
    });
    const paymentReview = createPaymentReviewModule({
      pool,
      auth,
      paymentQueries: bookings.paymentQueries,
      env,
    });
    const tickets = createTicketsModule({
      pool,
      auth,
      soldBookings: createBookingTicketQueries({ pool }),
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
      search,
      tickets,
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
    passwordResetWorker = auth.maintenance?.startPasswordResetWorker?.({
      onFailure: () => logger.error('No se pudo procesar la recuperación de cuenta.'),
    });
    notificationWorker = notifications.maintenance.startWorker({
      onFailure: (failure) => logger.error(failure, 'No se pudo procesar los avisos por correo.'),
    });
    logger.info({ port }, 'Servidor iniciado');
  } catch (error) {
    await Promise.allSettled([
      stopExpiration(),
      stopPasswordReset(),
      stopNotifications(),
      server ? closeServer(server) : Promise.resolve(),
    ]);
    await pool.end();
    throw error;
  }
  let closing;
  const stop = () => {
    if (!closing) {
      const stopping = stopExpiration();
      const stoppingPasswordReset = stopPasswordReset();
      const stoppingNotifications = stopNotifications();
      closing = (async () => {
        try {
          const results = await Promise.allSettled([
            closeServer(server),
            stopping,
            stoppingPasswordReset,
            stoppingNotifications,
          ]);
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
    void stopPasswordReset().catch(() =>
      logger.error('No se pudo detener el trabajador de recuperación.'),
    );
    void stopNotifications().catch(() =>
      logger.error('No se pudo detener el trabajador de avisos.'),
    );
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
