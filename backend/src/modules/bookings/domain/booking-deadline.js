const { BookingValidationError } = require('./booking-error');

const MIN_PROOF_WINDOW_SECONDS = 180;
const MAX_PROOF_WINDOW_SECONDS = 300;
const MILLISECONDS_PER_SECOND = 1000;

function assertDate(value) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new BookingValidationError();
  }
}

function createBookingDeadline(startedAt, windowSeconds) {
  assertDate(startedAt);
  if (
    !Number.isInteger(windowSeconds) ||
    windowSeconds < MIN_PROOF_WINDOW_SECONDS ||
    windowSeconds > MAX_PROOF_WINDOW_SECONDS
  ) {
    throw new BookingValidationError();
  }
  const expiresAt = new Date(startedAt.getTime() + windowSeconds * MILLISECONDS_PER_SECOND);
  assertDate(expiresAt);
  return expiresAt;
}

// Solo para una reserva pendiente elegible; no decide el rechazo ni confirma pagos.
function hasBookingDeadlineElapsed({ expiresAt, now, hasPaymentProof } = {}) {
  assertDate(expiresAt);
  assertDate(now);
  if (typeof hasPaymentProof !== 'boolean') throw new BookingValidationError();
  return !hasPaymentProof && now.getTime() >= expiresAt.getTime();
}

module.exports = {
  createBookingDeadline,
  hasBookingDeadlineElapsed,
  MIN_PROOF_WINDOW_SECONDS,
  MAX_PROOF_WINDOW_SECONDS,
};
