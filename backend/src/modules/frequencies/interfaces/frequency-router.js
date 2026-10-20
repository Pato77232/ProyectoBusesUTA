const express = require('express');
const { FrequencyError } = require('../domain/frequency-error');

const ERRORS = {
  VALIDATION_ERROR: [400, 'Datos de frecuencia inválidos.'],
  FREQUENCY_REQUIRES_ANT_RESOLUTION: [
    400,
    'La frecuencia requiere un número de resolución de la ANT.',
  ],
  FREQUENCY_SEGMENT_PRICES_MISMATCH: [
    400,
    'La cantidad de precios no coincide con la cantidad de tramos.',
  ],
  FREQUENCY_ALREADY_EXISTS: [
    409,
    'Ya existe una frecuencia con esa ruta y hora en la cooperativa.',
  ],
  FREQUENCY_NOT_FOUND: [404, 'Frecuencia no encontrada.'],
  FORBIDDEN: [403, 'Acceso no permitido.'],
};

function createRouter({
  createFrequencyUseCase,
  getFrequencyUseCase,
  listFrequenciesUseCase,
  changeFrequencyStatusUseCase,
  auth,
}) {
  const router = express.Router();

  router.use(auth.authenticate);

  router.post(
    '/',
    auth.authorize('COOPERATIVE_ADMIN'),
    auth.csrfProtection,
    async (req, res, next) => {
      try {
        const frequency = await createFrequencyUseCase(req.body, req.auth.user);
        res.status(201).json({ frequency });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get('/', auth.authorize('COOPERATIVE_ADMIN'), async (req, res, next) => {
    try {
      const frequencies = await listFrequenciesUseCase(req.query, req.auth.user);
      res.status(200).json({ frequencies });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', auth.authorize('COOPERATIVE_ADMIN'), async (req, res, next) => {
    try {
      const frequency = await getFrequencyUseCase(req.params.id, req.auth.user);
      res.status(200).json({ frequency });
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    '/:id/status',
    auth.authorize('COOPERATIVE_ADMIN'),
    auth.csrfProtection,
    async (req, res, next) => {
      try {
        const frequency = await changeFrequencyStatusUseCase(
          req.params.id,
          req.body?.status,
          req.auth.user,
        );
        res.status(200).json({ frequency });
      } catch (error) {
        next(error);
      }
    },
  );

  router.use((error, req, res, next) => {
    if (!(error instanceof FrequencyError) || !ERRORS[error.code]) return next(error);
    const [status, message] = ERRORS[error.code];
    res.status(status).json({ error: { code: error.code, message } });
  });

  return router;
}

module.exports = createRouter;
