const express = require('express');
const DomainError = require('../../../shared/errors/domain-error');
const errors = require('../application/booking-errors');

const ERROR_STATUS = Object.freeze({
  BOOKING_VALIDATION_ERROR: 400,
  BOOKING_TRIP_DATA_INTEGRITY_ERROR: 500,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  BOOKING_TRIP_UNAVAILABLE: 404,
  BOOKING_SEAT_CONFLICT: 409,
  BOOKING_ALREADY_EXISTS: 409,
  BOOKING_SUMMARY_CHANGED: 409,
  BOOKING_ZERO_TOTAL_UNSUPPORTED: 409,
  BOOKING_REQUEST_KEY_REUSED: 409,
  BOOKING_BENEFIT_REVIEW_REQUIRED: 409,
  BOOKING_TRIP_SERVICE_UNAVAILABLE: 503,
  BOOKING_BENEFIT_SERVICE_UNAVAILABLE: 503,
  BOOKING_CASH_NOT_FOUND: 404,
  BOOKING_CASH_CONFLICT: 409,
  BOOKING_CASH_EXPIRED: 409,
  BOOKING_CASH_UNCERTAIN: 503,
});

function requireJson(req, res, next) {
  if (!req.is('application/json'))
    return next(new DomainError('Se requiere un cuerpo JSON.', 'UNSUPPORTED_MEDIA_TYPE', 415));
  next();
}

function segment(query) {
  if (
    Object.keys(query).some((key) => !['tripId', 'fromPosition', 'toPosition'].includes(key)) ||
    ![query.fromPosition, query.toPosition].every(
      (value) => typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value),
    )
  )
    throw new errors.BookingValidationError();
  return {
    tripId: query.tripId,
    fromPosition: Number(query.fromPosition),
    toPosition: Number(query.toPosition),
  };
}

/**
 * BOOK-CAJA-02: boletería del oficinista. La cooperativa sale de la sesión CLERK; cotizar,
 * reservar y cobrar vuelven a exigirla en el servidor.
 */
function createCounterRouter({ auth, getSeatAvailability, getSeatMap, counterSales }) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(auth.authenticate, auth.authorize('CLERK'));
  router.get('/availability', async (req, res) => {
    res.json({ seats: await getSeatAvailability(segment(req.query)) });
  });
  router.get('/seat-map', async (req, res) => {
    res.json({ seats: await getSeatMap(segment(req.query)) });
  });
  router.post('/bookings/summary', auth.csrfProtection, requireJson, async (req, res) => {
    res.json(await counterSales.summary(req.body, req.auth));
  });
  router.post('/bookings', auth.csrfProtection, requireJson, async (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Object.hasOwn(req.body, 'requestKey'))
      throw new errors.BookingValidationError();
    const booking = await counterSales.create(
      { ...req.body, requestKey: req.get('Idempotency-Key') },
      req.auth,
    );
    res.status(201).json({ booking });
  });
  router.post('/bookings/:bookingId/cash', auth.csrfProtection, requireJson, async (req, res) => {
    res.json({ sale: await counterSales.confirmCash(req.params.bookingId, req.body, req.auth) });
  });
  router.use((error, req, res, next) => {
    const known = Object.values(errors).some((ErrorClass) => error instanceof ErrorClass);
    const status = ERROR_STATUS[error.code];
    if (!known || !status) return next(error);
    res.status(status).json({ error: { code: error.code, message: error.message } });
  });
  return router;
}

module.exports = createCounterRouter;
