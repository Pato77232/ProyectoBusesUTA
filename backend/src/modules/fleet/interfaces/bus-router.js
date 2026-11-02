const express = require('express');
const { readBusMultipart } = require('./read-bus-multipart');
const validateBusPhotos = require('./validate-bus-photos');
const errors = require('../domain/bus-registration-error');

const STATUS = new Map([
  [errors.BusRegistrationForbiddenError, 403],
  [errors.BusRegistrationValidationError, 400],
  [errors.BusSeatLayoutNotFoundError, 400],
  [errors.BusGroupNotFoundError, 404],
  [errors.BusAlreadyExistsError, 409],
]);

function createBusRouter({ auth, createBus }) {
  const router = express.Router();
  router.post(
    '/',
    auth.authenticate,
    auth.authorize('COOPERATIVE_ADMIN'),
    auth.csrfProtection,
    async (req, res) => {
      const upload = await readBusMultipart(req);
      const photos = await validateBusPhotos(upload.photos);
      if (req.aborted || res.destroyed) throw new Error('Carga interrumpida.');
      const bus = await createBus({ data: upload.data, photos }, req.auth.user);
      res.status(201).json({ bus });
    },
  );
  router.use((error, req, res, next) => {
    for (const [Type, httpStatus] of STATUS) {
      if (error instanceof Type) error.httpStatus = httpStatus;
    }
    next(error);
  });
  return router;
}

module.exports = createBusRouter;
