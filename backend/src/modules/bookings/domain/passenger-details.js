const { BookingValidationError } = require('./booking-error');
const { createPassenger } = require('./passenger');
const { createEcuadorianIdentification } = require('./ecuadorian-identification');

const FIELDS = Object.freeze(['seatId', 'identificationNumber', 'fullName', 'birthDate']);
const CALENDAR_DATE_PATTERN = /^(?!0000)\d{4}-\d{2}-\d{2}$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function calendarDate(value) {
  if (typeof value !== 'string' || !CALENDAR_DATE_PATTERN.test(value)) {
    throw new BookingValidationError();
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BookingValidationError();
  }
  return value;
}

function passengerName(value) {
  if (typeof value !== 'string' || CONTROL_CHARACTERS.test(value) || !/\p{L}/u.test(value)) {
    throw new BookingValidationError();
  }
  return value.trim();
}

// Captura datos declarados; una estructura válida no acredita identidad ni beneficios.
function createPassengerDetails(input, context) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((field) => !FIELDS.includes(field))
  ) {
    throw new BookingValidationError();
  }
  const onDate = calendarDate(context?.onDate);
  const birthDate = calendarDate(input.birthDate);
  if (birthDate > onDate) throw new BookingValidationError();
  const passenger = createPassenger({
    seatId: input.seatId,
    identificationNumber: createEcuadorianIdentification(input.identificationNumber),
  });

  return Object.freeze({ ...passenger, fullName: passengerName(input.fullName), birthDate });
}

module.exports = { createPassengerDetails };
