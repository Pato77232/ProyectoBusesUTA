const express = require('express');
const notFoundHandler = require('./shared/middlewares/not-found-handler');
const errorHandler = require('./shared/middlewares/error-handler');

const API_PREFIX = '/api/v1';

/**
 * Composición de Express. Punto único de montaje de middlewares y rutas.
 * Los módulos exponen sus rutas por su API pública y se registran aquí.
 */
function createApp({
  auth,
  tenants,
  fleet,
  frequencies,
  routeSheets,
  payments,
  bookings,
  pool,
  trustProxy = false,
} = {}) {
  const app = express();

  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', 'loopback');
  // También protege los errores JSON que ocurren antes de entrar al router privado.
  if (bookings) {
    app.use(`${API_PREFIX}/bookings`, (req, res, next) => {
      res.set('Cache-Control', 'no-store');
      next();
    });
  }
  // El alta de Fleet autentica antes de consumir cualquier cuerpo, incluido JSON inválido.
  if (fleet?.busRouter) app.use(`${API_PREFIX}/buses`, fleet.busRouter);
  app.use(express.json());

  app.get(`${API_PREFIX}/health`, async (req, res) => {
    if (pool) await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  });

  if (auth) app.use(`${API_PREFIX}/auth`, auth.router);

  if (auth?.cooperativeAdminRouter)
    app.use(`${API_PREFIX}/cooperatives`, auth.cooperativeAdminRouter);

  if (tenants) app.use(`${API_PREFIX}/cooperatives`, tenants.router);

  if (fleet) app.use(`${API_PREFIX}/bus-groups`, fleet.router);

  if (fleet?.seatLayoutRouter) app.use(`${API_PREFIX}/seat-layouts`, fleet.seatLayoutRouter);

  if (frequencies) app.use(`${API_PREFIX}/frequencies`, frequencies.router);

  if (routeSheets) app.use(`${API_PREFIX}/route-sheets`, routeSheets.router);

  if (payments) app.use(`${API_PREFIX}/payment-proofs`, payments.router);

  if (bookings) app.use(`${API_PREFIX}/bookings`, bookings.router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
