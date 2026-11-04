const {
  createPassengerDetails,
} = require('../../../src/modules/bookings/domain/passenger-details');
const { BookingValidationError } = require('../../../src/modules/bookings/domain/booking-error');

const context = Object.freeze({ onDate: '2026-10-25' });
// Cédula sintética: solo sirve para comprobar el algoritmo, no una identidad real.
const valid = Object.freeze({
  seatId: '01',
  identificationNumber: '0100000009',
  fullName: 'María José O’Connor',
  birthDate: '2000-02-29',
});

test('compone cédula y asiento con nombre y nacimiento sin acreditar identidad', () => {
  const result = createPassengerDetails(valid, context);
  expect(result).toEqual(valid);
  expect(Object.keys(result)).toEqual(['seatId', 'identificationNumber', 'fullName', 'birthDate']);
});

test('recorta extremos conservando acentos, puntuación y ceros iniciales', () => {
  const result = createPassengerDetails(
    {
      ...valid,
      seatId: ' 01 ',
      identificationNumber: ' 0100000009 ',
      fullName: ' María José O’Connor ',
    },
    context,
  );
  expect(result).toEqual(valid);
});

test.each(['Ana', '李', "Jean-Luc D'Arcy"])(
  'admite nombres Unicode y de una palabra: %s',
  (fullName) => {
    expect(createPassengerDetails({ ...valid, fullName }, context).fullName).toBe(fullName);
  },
);

test.each([null, undefined, [], 'pasajero', 1, {}].map((value) => [value]))(
  'rechaza una entrada que no contiene los datos del pasajero: %j',
  (input) => {
    expect(() => createPassengerDetails(input, context)).toThrow(BookingValidationError);
  },
);

test.each([undefined, null, '', '   ', 123, {}, '12345', '---', 'Ana\nPérez', 'Ana\u0000Pérez'])(
  'rechaza nombre vacío o con formato inválido: %j',
  (fullName) => {
    expect(() => createPassengerDetails({ ...valid, fullName }, context)).toThrow(
      BookingValidationError,
    );
  },
);

test.each([undefined, null, '', '0100000008', '010000000', '0000000000', 100000009])(
  'exige estructura y verificador de cédula válidos: %j',
  (identificationNumber) => {
    expect(() => createPassengerDetails({ ...valid, identificationNumber }, context)).toThrow(
      BookingValidationError,
    );
  },
);

test.each([undefined, null, '', '   ', 1])('exige asiento válido: %j', (seatId) => {
  expect(() => createPassengerDetails({ ...valid, seatId }, context)).toThrow(
    BookingValidationError,
  );
});

test.each([
  undefined,
  null,
  '',
  '2025-02-29',
  '1900-02-29',
  '2000-02-30',
  '2026-04-31',
  '2026-10-26',
  '2027-01-01',
  '0000-01-01',
  '2026-1-01',
  '25/10/2026',
  '2026-10-25T00:00:00Z',
  ' 2000-02-29 ',
])('rechaza nacimiento inválido o posterior a la referencia: %j', (birthDate) => {
  expect(() => createPassengerDetails({ ...valid, birthDate }, context)).toThrow(
    BookingValidationError,
  );
});

test.each([undefined, null, {}, { onDate: '2026-02-30' }, { onDate: new Date() }])(
  'exige una fecha local explícita y válida del servidor: %j',
  (invalidContext) => {
    expect(() => createPassengerDetails(valid, invalidContext)).toThrow(BookingValidationError);
  },
);

test.each(['2026-10-25', '2026-10-24', '2025-12-31', '0100-01-01', '0099-12-31'])(
  'acepta una fecha civil válida no futura: %s',
  (birthDate) => {
    expect(createPassengerDetails({ ...valid, birthDate }, context).birthDate).toBe(birthDate);
  },
);

test('un nacimiento deja de ser futuro al cambiar la referencia explícita', () => {
  const input = { ...valid, birthDate: '2026-10-26' };
  expect(() => createPassengerDetails(input, context)).toThrow(BookingValidationError);
  expect(createPassengerDetails(input, { onDate: '2026-10-26' }).birthDate).toBe('2026-10-26');
});

test.each([
  'verified',
  'disabilityVerified',
  'discountPercent',
  'price',
  'cooperative_id',
  'onDate',
])('rechaza el campo adicional %s', (field) => {
  expect(() => createPassengerDetails({ ...valid, [field]: true }, context)).toThrow(
    BookingValidationError,
  );
});

test('devuelve una copia inmutable sin modificar entrada o contexto', () => {
  const result = createPassengerDetails(valid, context);
  expect(result).not.toBe(valid);
  expect(Object.isFrozen(result)).toBe(true);
  expect(valid.fullName).toBe('María José O’Connor');
  expect(context.onDate).toBe('2026-10-25');
  expect(() => {
    'use strict';
    result.fullName = 'Otro';
  }).toThrow(TypeError);
});
