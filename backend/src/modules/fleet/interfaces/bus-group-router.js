const express = require('express');
const { BusGroupError } = require('../application/create-bus-group.use-case');

const ERRORS = {
  VALIDATION_ERROR: [400, 'Datos de grupo de buses inválidos.'],
  FORBIDDEN: [403, 'Acceso no permitido.'],
  BUS_GROUP_ALREADY_EXISTS: [409, 'Ya existe un grupo de buses con ese nombre.'],
};

function createRouter({ createBusGroup, listBusGroups, auth }) {
  const router = express.Router();

  router.post(
    '/',
    auth.authenticate,
    auth.authorize('COOPERATIVE_ADMIN'),
    auth.csrfProtection,
    async (req, res) => {
      const busGroup = await createBusGroup(req.body, req.auth.user);
      res.status(201).json({ busGroup });
    },
  );

  router.get(
    '/',
    auth.authenticate,
    auth.authorize('COOPERATIVE_ADMIN'),
    async (req, res) => {
      const busGroups = await listBusGroups(req.auth.user);
      res.status(200).json({ busGroups });
    },
  );

  router.use((error, req, res, next) => {
    if (!(error instanceof BusGroupError) || !ERRORS[error.code]) return next(error);
    const [status, message] = ERRORS[error.code];
    res.status(status).json({ error: { code: error.code, message } });
  });

  return router;
}

module.exports = createRouter;
