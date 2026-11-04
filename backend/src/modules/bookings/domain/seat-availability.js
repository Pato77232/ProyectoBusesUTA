const { BookingValidationError } = require('./booking-error');

const SEAT_STATUSES = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  SOLD: 'SOLD',
});

function assertIdentifier(value) {
  if (typeof value !== 'string' || !value.trim()) throw new BookingValidationError();
}

function assertRange(range) {
  if (
    !range ||
    !Number.isSafeInteger(range.fromPosition) ||
    !Number.isSafeInteger(range.toPosition) ||
    range.fromPosition < 0 ||
    range.fromPosition >= range.toPosition
  ) {
    throw new BookingValidationError();
  }
}

function assertContext(value) {
  assertRange(value);
  assertIdentifier(value.tripId);
  assertIdentifier(value.cooperativeId);
}

function rangesOverlap(first, second) {
  assertRange(first);
  assertRange(second);
  return first.fromPosition < second.toPosition && second.fromPosition < first.toPosition;
}

function validateAllocation(allocation) {
  assertContext(allocation);
  assertIdentifier(allocation.seatId);
  if (![SEAT_STATUSES.RESERVED, SEAT_STATUSES.SOLD].includes(allocation.status)) {
    throw new BookingValidationError();
  }
}

// La fuente debe proporcionar inventario real y ocupaciones efectivas del servidor.
// Esta consulta no sustituye el bloqueo transaccional al confirmar la reserva.
function listSeatAvailability({ query, seatIds, allocations } = {}) {
  assertContext(query);
  if (!Array.isArray(seatIds) || !Array.isArray(allocations)) {
    throw new BookingValidationError();
  }
  for (const seatId of seatIds) assertIdentifier(seatId);
  if (new Set(seatIds).size !== seatIds.length) throw new BookingValidationError();

  const states = new Map(seatIds.map((seatId) => [seatId, SEAT_STATUSES.AVAILABLE]));
  for (const allocation of allocations) {
    validateAllocation(allocation);
    if (
      allocation.tripId !== query.tripId ||
      allocation.cooperativeId !== query.cooperativeId ||
      !states.has(allocation.seatId) ||
      !rangesOverlap(query, allocation)
    ) {
      continue;
    }
    if (states.get(allocation.seatId) !== SEAT_STATUSES.SOLD) {
      states.set(allocation.seatId, allocation.status);
    }
  }

  return Object.freeze(
    seatIds.map((seatId) => Object.freeze({ seatId, status: states.get(seatId) })),
  );
}

module.exports = { listSeatAvailability, rangesOverlap, SEAT_STATUSES };
