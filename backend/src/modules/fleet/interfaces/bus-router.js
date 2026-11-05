const express = require('express');
const { readBusMultipart } = require('./read-bus-multipart');
const validateBusPhotos = require('./validate-bus-photos');
const errors = require('../domain/bus-registration-error');
const queryErrors = require('../domain/bus-query-error');

const STATUS = new Map([
  [errors.BusRegistrationForbiddenError, 403],
  [errors.BusRegistrationValidationError, 400],
  [errors.BusSeatLayoutNotFoundError, 400],
  [errors.BusGroupNotFoundError, 404],
  [errors.BusAlreadyExistsError, 409],
]);

function createBusRouter({ auth, createBus, listBuses, getBusDetails, getBusPhoto }) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
  });
  const sendPrivate = (res, next, action) => {
    res.set('Cache-Control', 'private, no-store');
    return action().catch(next);
  };

  router.get('/', auth.authenticate, auth.authorize('COOPERATIVE_ADMIN'), (req, res, next) =>
    sendPrivate(res, next, async () => {
      const buses = await listBuses(req.auth.user);
      res.status(200).json({ buses });
    }),
  );

  router.get(
    '/:busId/photos/:photoId',
    auth.authenticate,
    auth.authorize('COOPERATIVE_ADMIN'),
    (req, res, next) =>
      sendPrivate(res, next, async () => {
        const photo = await getBusPhoto(
          { busId: req.params.busId, photoId: req.params.photoId },
          req.auth.user,
        );
        res
          .status(200)
          .set('Content-Type', photo.contentType)
          .set('Content-Length', String(photo.bytes.length))
          .set('X-Content-Type-Options', 'nosniff')
          .send(photo.bytes);
      }),
  );

  router.get('/:busId', auth.authenticate, auth.authorize('COOPERATIVE_ADMIN'), (req, res, next) =>
    sendPrivate(res, next, async () => {
      const bus = await getBusDetails(req.params.busId, req.auth.user);
      res.status(200).json({ bus });
    }),
  );

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
    if (error instanceof queryErrors.BusQueryForbiddenError) error.httpStatus = 403;
    if (
      error instanceof queryErrors.BusNotFoundError ||
      error instanceof queryErrors.BusPhotoNotFoundError
    ) {
      error.httpStatus = 404;
      error.code = 'BUS_NOT_FOUND';
      error.message = 'El bus no está disponible.';
    }
    for (const [Type, httpStatus] of STATUS) {
      if (error instanceof Type) error.httpStatus = httpStatus;
    }
    next(error);
  });
  return router;
}

module.exports = createBusRouter;
