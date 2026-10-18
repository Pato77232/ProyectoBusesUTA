const express = require('express');
const { CooperativeError } = require('../application/create-cooperative.use-case');
const ERRORS = {
  VALIDATION_ERROR: [400, 'Datos de cooperativa inválidos.'],
  FORBIDDEN: [403, 'Acceso no permitido.'],
  COOPERATIVE_ALREADY_EXISTS: [409, 'Ya existe una cooperativa con ese RUC.'],
};
function createRouter({ createCooperative, auth }) {
  const router = express.Router();
  router.post(
    '/',
    auth.authenticate,
    auth.authorize('SYSTEM_ADMIN'),
    auth.csrfProtection,
    async (req, res) => {
      const cooperative = await createCooperative(req.body, req.auth.user);
      res.status(201).json({ cooperative });
    },
  );
  router.use((error, req, res, next) => {
    if (!(error instanceof CooperativeError) || !ERRORS[error.code]) return next(error);
    const [status, message] = ERRORS[error.code];
    res.status(status).json({ error: { code: error.code, message } });
  });
  return router;
}
module.exports = createRouter;
