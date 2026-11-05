const { createHash } = require('node:crypto');
const { BookingValidationError } = require('./booking-error');

const REQUEST_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;

function validateRequestKey(value) {
  if (typeof value !== 'string' || !REQUEST_KEY_PATTERN.test(value)) {
    throw new BookingValidationError();
  }
  return value;
}

// Recibe solo la copia de entrada permitida. La huella no es una credencial.
function bookingCreationFingerprint(request, acceptedSummaryRevision) {
  const passengers = request.passengers
    .map((passenger) => ({
      seatId: passenger.seatId,
      identificationNumber: passenger.identificationNumber,
      fullName: passenger.fullName,
      birthDate: passenger.birthDate,
      ...(passenger.contact !== undefined ? { contact: passenger.contact } : {}),
    }))
    .sort((left, right) => (left.seatId < right.seatId ? -1 : left.seatId > right.seatId ? 1 : 0));
  const payload = {
    tripId: request.tripId,
    fromPosition: request.fromPosition,
    toPosition: request.toPosition,
    seatIds: request.seatIds,
    passengers,
    acceptedSummaryRevision,
  };
  return createHash('sha256')
    .update('bookings-creation-v1\n')
    .update(JSON.stringify(payload))
    .digest('hex');
}

function createBookingOperation(input) {
  if (
    typeof input?.ownerId !== 'string' ||
    !input.ownerId.trim() ||
    typeof input.requestFingerprint !== 'string' ||
    !FINGERPRINT_PATTERN.test(input.requestFingerprint)
  )
    throw new BookingValidationError();
  return Object.freeze({
    ownerId: input.ownerId.trim(),
    requestKey: validateRequestKey(input.requestKey),
    requestFingerprint: input.requestFingerprint,
  });
}

module.exports = { validateRequestKey, bookingCreationFingerprint, createBookingOperation };
