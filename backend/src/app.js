const express = require('express');
const notFoundHandler = require('./shared/middlewares/not-found-handler');
const errorHandler = require('./shared/middlewares/error-handler');

const API_PREFIX = '/api/v1';

/**
 * Composición de Express. Punto único de montaje de middlewares y rutas.
 * Los módulos exponen sus rutas por su API pública y se registran aquí.
 */
function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.get(`${API_PREFIX}/health`, (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
