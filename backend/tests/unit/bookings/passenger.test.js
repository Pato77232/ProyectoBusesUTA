const { createPassenger } = require('../../../src/modules/bookings/domain/passenger');
const { BookingValidationError } = require('../../../src/modules/bookings/domain/booking-error');

// Dato ficticio: no representa una identidad verificada ni una cédula acreditada.
const valid = Object.freeze({ seatId: '01', identificationNumber: '0012345678' });

test('asocia cédula al asiento conservando ceros iniciales', () => {
  expect(createPassenger(valid)).toEqual(valid);
});

test('recorta espacios exteriores sin modificar la entrada', () => {
  const input = Object.freeze({ seatId: ' 01 ', identificationNumber: ' 0012345678 ' });
  const passenger = createPassenger(input);
  expect(passenger).toEqual(valid);
  expect(input.identificationNumber).toBe(' 0012345678 ');
});

test.each([null, undefined, [], 'pasajero', {}])('rechaza entrada inválida: %j', (input) => {
  expect(() => createPassenger(input)).toThrow(BookingValidationError);
});

test.each([undefined, null, '', '  ', 1234567890, {}, []])(
  'exige cédula como texto no vacío: %j',
  (identificationNumber) => {
    expect(() => createPassenger({ ...valid, identificationNumber })).toThrow(
      BookingValidationError,
    );
  },
);

test.each([undefined, null, '', '  ', 1])('exige asiento explícito: %j', (seatId) => {
  expect(() => createPassenger({ ...valid, seatId })).toThrow(BookingValidationError);
});

test.each(['role', 'cooperative_id', 'price', 'discount', 'verified'])(
  'rechaza el campo %s',
  (key) => {
    expect(() => createPassenger({ ...valid, [key]: true })).toThrow(BookingValidationError);
  },
);

test('devuelve una copia inmutable sin añadir datos de acreditación', () => {
  const passenger = createPassenger(valid);
  expect(passenger).not.toBe(valid);
  expect(Object.isFrozen(passenger)).toBe(true);
  expect(Object.keys(passenger)).toEqual(['seatId', 'identificationNumber']);
});
