const {
  createEcuadorianIdentification,
} = require('../../../src/modules/bookings/domain/ecuadorian-identification');
const { BookingValidationError } = require('../../../src/modules/bookings/domain/booking-error');

// Secuencias sintéticas para comprobar aritmética; no son identidades acreditadas.
test.each(['0100000009', '0100000090', '0900000001'])(
  'acepta estructura y módulo 10 conservando texto: %s',
  (identification) => {
    expect(createEcuadorianIdentification(identification)).toBe(identification);
  },
);

test('recorta solo espacios exteriores', () => {
  expect(createEcuadorianIdentification(' 0100000009 ')).toBe('0100000009');
});

test.each([
  undefined,
  null,
  100000009,
  '',
  '0000000000',
  '010000000',
  '01000000090',
  '0100000008',
  '01000000A9',
  '010 000009',
  '0100000009\n0',
])('rechaza estructura o verificador incorrectos: %j', (input) => {
  expect(() => createEcuadorianIdentification(input)).toThrow(BookingValidationError);
});
