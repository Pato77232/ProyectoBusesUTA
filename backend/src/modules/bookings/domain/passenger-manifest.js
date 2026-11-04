const { BookingValidationError } = require('./booking-error');
const { createPassengerDetails } = require('./passenger-details');

const FIELDS = Object.freeze(['seatIds', 'passengers']);

function selectedSeats(seatIds) {
  if (!Array.isArray(seatIds) || seatIds.length === 0) throw new BookingValidationError();
  const seats = new Set();
  for (const seatId of seatIds) {
    if (typeof seatId !== 'string' || !seatId.trim() || seats.has(seatId.trim())) {
      throw new BookingValidationError();
    }
    seats.add(seatId.trim());
  }
  return seats;
}

// La correspondencia no sustituye la consulta de plantilla ni el bloqueo en PostgreSQL.
function createPassengerManifest(input, context) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((field) => !FIELDS.includes(field))
  ) {
    throw new BookingValidationError();
  }
  const seats = selectedSeats(input.seatIds);
  if (!Array.isArray(input.passengers) || input.passengers.length !== seats.size) {
    throw new BookingValidationError();
  }

  const passengers = new Map();
  for (const inputPassenger of input.passengers) {
    const passenger = createPassengerDetails(inputPassenger, context);
    if (!seats.has(passenger.seatId) || passengers.has(passenger.seatId)) {
      throw new BookingValidationError();
    }
    passengers.set(passenger.seatId, passenger);
  }
  return Object.freeze([...seats].map((seatId) => passengers.get(seatId)));
}

module.exports = { createPassengerManifest };
