const { BookingValidationError } = require('./booking-error');
const { ageOnDate } = require('./passenger-quote');
function invalid() {
  throw new BookingValidationError();
}
function contact(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !['email', 'guardian'].includes(key)) ||
    typeof input.email !== 'string'
  )
    invalid();
  const email = input.email.trim();
  if (
    email.length > 254 ||
    !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ||
    /[\u0000-\u001f\u007f]/.test(email)
  )
    invalid();
  let guardian;
  if (input.guardian !== undefined) {
    const value = input.guardian;
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).length !== 2 ||
      typeof value.fullName !== 'string' ||
      !value.fullName.trim() ||
      value.fullName.length > 200 ||
      /[\u0000-\u001f\u007f]/.test(value.fullName) ||
      typeof value.birthDate !== 'string'
    )
      invalid();
    ageOnDate(value.birthDate, value.birthDate);
    guardian = Object.freeze({ fullName: value.fullName.trim(), birthDate: value.birthDate });
  }
  return Object.freeze({ email, ...(guardian ? { guardian } : {}) });
}
function validatePassengerContact(passenger, departureDate) {
  if (passenger.contact === undefined) return;
  const value = contact(passenger.contact);
  const minor = ageOnDate(passenger.birthDate, departureDate) < 18;
  if (minor && (!value.guardian || ageOnDate(value.guardian.birthDate, departureDate) < 18))
    invalid();
  if (!minor && value.guardian) invalid();
}
module.exports = { contact, validatePassengerContact };
