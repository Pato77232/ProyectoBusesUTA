const { BookingValidationError } = require('./booking-error');

const FIELDS = Object.freeze(['seatId', 'identificationNumber']);

// Esta primera tarea exige cédula por asiento; no certifica identidad ni beneficios.
function createPassenger(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !FIELDS.includes(key)) ||
    FIELDS.some((field) => typeof input[field] !== 'string' || !input[field].trim())
  ) {
    throw new BookingValidationError();
  }

  return Object.freeze({
    seatId: input.seatId.trim(),
    identificationNumber: input.identificationNumber.trim(),
  });
}

module.exports = { createPassenger };
