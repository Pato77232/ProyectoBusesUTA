const { BookingValidationError } = require('./booking-error');

const IDENTIFICATION_PATTERN = /^[0-9]{10}$/;
const CHECKSUM_MODULUS = 10;
const COEFFICIENTS = Object.freeze([2, 1, 2, 1, 2, 1, 2, 1, 2]);

// Comprueba estructura y módulo 10; no consulta Registro Civil ni acredita identidad.
function createEcuadorianIdentification(value) {
  if (typeof value !== 'string') throw new BookingValidationError();
  const identification = value.trim();
  if (!IDENTIFICATION_PATTERN.test(identification) || identification === '0000000000') {
    throw new BookingValidationError();
  }
  const sum = COEFFICIENTS.reduce((total, coefficient, index) => {
    const product = Number(identification[index]) * coefficient;
    return total + (product > 9 ? product - 9 : product);
  }, 0);
  const expected = (CHECKSUM_MODULUS - (sum % CHECKSUM_MODULUS)) % CHECKSUM_MODULUS;
  if (Number(identification[9]) !== expected) throw new BookingValidationError();
  return identification;
}

module.exports = { createEcuadorianIdentification };
