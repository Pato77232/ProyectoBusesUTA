const express = require('express');
const DomainError = require('../../../shared/errors/domain-error');
const errors = require('../application/booking-errors');

const ERROR_STATUS = Object.freeze({
  BOOKING_VALIDATION_ERROR: 400,
  BOOKING_TRIP_DATA_INTEGRITY_ERROR: 500,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  BOOKING_TRIP_UNAVAILABLE: 404,
  BOOKING_ATTEMPT_NOT_FOUND: 404,
  BOOKING_SEAT_CONFLICT: 409,
  BOOKING_ALREADY_EXISTS: 409,
  BOOKING_SUMMARY_CHANGED: 409,
  BOOKING_ZERO_TOTAL_UNSUPPORTED: 409,
  BOOKING_REQUEST_KEY_REUSED: 409,
  BOOKING_BENEFIT_REVIEW_REQUIRED: 409,
  BOOKING_TRIP_SERVICE_UNAVAILABLE: 503,
  BOOKING_BENEFIT_SERVICE_UNAVAILABLE: 503,
});

function requireJson(req, res, next) {
  if (!req.is('application/json')) {
    return next(new DomainError('Se requiere un cuerpo JSON.', 'UNSUPPORTED_MEDIA_TYPE', 415));
  }
  next();
}

function availabilityInput(query) {
  if (
    Object.keys(query).some((key) => !['tripId', 'fromPosition', 'toPosition'].includes(key)) ||
    ![query.fromPosition, query.toPosition].every(
      (value) => typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value),
    )
  ) {
    throw new errors.BookingValidationError();
  }
  return {
    tripId: query.tripId,
    fromPosition: Number(query.fromPosition),
    toPosition: Number(query.toPosition),
  };
}

function createBookingRouter({
  auth,
  getSeatAvailability,
  getAccessibleAvailability,
  getBookingSummary,
  createBooking,
  getBookingAttempt,
  getBookingHistory,
}) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(auth.authenticate, auth.authorize('CUSTOMER'));
  router.get('/availability', async (req, res) => {
    const seats = await getSeatAvailability(availabilityInput(req.query));
    res.json({ seats });
  });
  router.get('/accessible-availability', async (req, res) => {
    const seats = await getAccessibleAvailability(availabilityInput(req.query));
    res.json({ seats });
  });
  router.get('/attempts/:requestKey', async (req, res) => {
    if (Object.keys(req.query).length) throw new errors.BookingValidationError();
    res.json({ booking: await getBookingAttempt(req.params.requestKey, req.auth) });
  });
  router.get('/', async (req, res) => {
    if (Object.keys(req.query).some((key) => !['cursor', 'limit'].includes(key)))
      throw new errors.BookingValidationError();
    res.json({ bookings: await getBookingHistory.list(req.query, req.auth) });
  });
  router.get('/:bookingId', async (req, res) => {
    if (Object.keys(req.query).length) throw new errors.BookingValidationError();
    res.json({ booking: await getBookingHistory.get(req.params.bookingId, req.auth) });
  });
  router.post('/summary', auth.csrfProtection, requireJson, async (req, res) => {
    res.json(await getBookingSummary(req.body, req.auth));
  });
  router.post('/', auth.csrfProtection, requireJson, async (req, res) => {
    if (
      !req.body ||
      typeof req.body !== 'object' ||
      Array.isArray(req.body) ||
      Object.hasOwn(req.body, 'requestKey')
    )
      throw new errors.BookingValidationError();
    const booking = await createBooking(
      { ...req.body, requestKey: req.get('Idempotency-Key') },
      req.auth,
    );
    res.status(201).json({ booking });
  });
  router.use((error, req, res, next) => {
    const known = Object.values(errors).some((ErrorClass) => error instanceof ErrorClass);
    const status = ERROR_STATUS[error.code];
    if (!known || !status) return next(error);
    res.status(status).json({ error: { code: error.code, message: error.message } });
  });
  return router;
}
module.exports = createBookingRouter;
