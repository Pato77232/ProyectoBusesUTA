const express = require('express');
const notFoundHandler = require('./shared/middlewares/not-found-handler');
const errorHandler = require('./shared/middlewares/error-handler');

const API_PREFIX = '/api/v1';

/**
 * Composición de Express. Punto único de montaje de middlewares y rutas.
 * Los módulos exponen sus rutas por su API pública y se registran aquí.
 */
function createApp({ auth, tenants, frequencies, pool, trustProxy = false } = {}) {
  const app = express();

  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', 'loopback');
  app.use(express.json());

  app.get(`${API_PREFIX}/health`, async (req, res) => {
    if (pool) await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  });

  if (auth) app.use(`${API_PREFIX}/auth`, auth.router);

  if (auth?.cooperativeAdminRouter)
    app.use(`${API_PREFIX}/cooperatives`, auth.cooperativeAdminRouter);

  if (tenants) app.use(`${API_PREFIX}/cooperatives`, tenants.router);

  if (frequencies) app.use(`${API_PREFIX}/frequencies`, frequencies.router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
