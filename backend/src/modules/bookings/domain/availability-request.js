const { BookingValidationError } = require('./booking-error');

const QUERY_FIELDS = Object.freeze(['tripId', 'fromPosition', 'toPosition']);

function validIdentifier(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function createAvailabilityRequest(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((field) => !QUERY_FIELDS.includes(field)) ||
    !validIdentifier(input.tripId) ||
    !Number.isSafeInteger(input.fromPosition) ||
    !Number.isSafeInteger(input.toPosition) ||
    input.fromPosition < 0 ||
    input.fromPosition >= input.toPosition
  ) {
    throw new BookingValidationError();
  }
  return Object.freeze({
    tripId: input.tripId.trim(),
    fromPosition: input.fromPosition,
    toPosition: input.toPosition,
  });
}

function createAvailabilityTrip(value, expectedTripId) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    value.tripId !== expectedTripId ||
    !validIdentifier(value.cooperativeId) ||
    !Number.isSafeInteger(value.routePointCount) ||
    value.routePointCount < 2 ||
    !Array.isArray(value.seatIds)
  ) {
    throw new BookingValidationError();
  }
  for (const seatId of value.seatIds) {
    if (!validIdentifier(seatId)) throw new BookingValidationError();
  }
  if (new Set(value.seatIds).size !== value.seatIds.length) {
    throw new BookingValidationError();
  }
  return Object.freeze({
    tripId: value.tripId,
    cooperativeId: value.cooperativeId,
    routePointCount: value.routePointCount,
    seatIds: Object.freeze([...value.seatIds]),
  });
}

module.exports = { createAvailabilityRequest, createAvailabilityTrip };
