const {
  createPassengerManifest,
} = require('../../../src/modules/bookings/domain/passenger-manifest');
const { BookingValidationError } = require('../../../src/modules/bookings/domain/booking-error');

const context = Object.freeze({ onDate: '2026-10-25' });
// Datos sintéticos: no representan identidades verificadas.
const first = Object.freeze({
  seatId: '01',
  identificationNumber: '0100000009',
  fullName: 'Ana Ejemplo',
  birthDate: '2000-01-01',
});
const second = Object.freeze({
  seatId: '02',
  identificationNumber: '0900000001',
  fullName: 'José Ejemplo',
  birthDate: '1990-02-28',
});
const valid = Object.freeze({
  seatIds: Object.freeze(['01', '02']),
  passengers: Object.freeze([first, second]),
});

test('admite un pasajero por cada asiento', () => {
  expect(createPassengerManifest(valid, context)).toEqual([first, second]);
  expect(createPassengerManifest({ seatIds: ['01'], passengers: [first] }, context)).toEqual([
    first,
  ]);
});

test('devuelve el orden de la selección aunque el formulario llegue en otro orden', () => {
  expect(createPassengerManifest({ ...valid, passengers: [second, first] }, context)).toEqual([
    first,
    second,
  ]);
  expect(createPassengerManifest({ ...valid, seatIds: ['02', '01'] }, context)).toEqual([
    second,
    first,
  ]);
});

test('normaliza los extremos de identificadores sin perder ceros', () => {
  const result = createPassengerManifest(
    {
      seatIds: [' 01 ', '02'],
      passengers: [{ ...first, seatId: ' 01 ' }, second],
    },
    context,
  );
  expect(result).toEqual([first, second]);
});

test.each([undefined, null, [], {}, 'lista'].map((value) => [value]))(
  'rechaza una entrada incompleta o inválida: %j',
  (input) => {
    expect(() => createPassengerManifest(input, context)).toThrow(BookingValidationError);
  },
);

test.each(
  [undefined, null, [], ['01', '01'], ['01', ' 01 '], [''], [1], ['01', null], Array(2)].map(
    (value) => [value],
  ),
)('rechaza selección inválida o repetida: %j', (seatIds) => {
  expect(() => createPassengerManifest({ ...valid, seatIds }, context)).toThrow(
    BookingValidationError,
  );
});

test.each(
  [
    undefined,
    null,
    [],
    [first],
    [first, second, second],
    [first, null],
    Array(2),
    [first, first],
    [first, { ...second, seatId: '03' }],
  ].map((value) => [value]),
)('rechaza pasajeros faltantes, repetidos o ajenos: %j', (passengers) => {
  expect(() => createPassengerManifest({ ...valid, passengers }, context)).toThrow(
    BookingValidationError,
  );
});

test.each([
  { identificationNumber: '0900000002' },
  { fullName: '' },
  { birthDate: '2026-10-26' },
  { disabilityVerified: true },
])('aplica los datos completos a cada pasajero sin omitir el inválido: %j', (change) => {
  expect(() =>
    createPassengerManifest(
      {
        ...valid,
        passengers: [first, { ...second, ...change }],
      },
      context,
    ),
  ).toThrow(BookingValidationError);
});

test.each(['cooperative_id', 'price', 'customerId', 'discount'])(
  'rechaza campo extra %s',
  (key) => {
    expect(() => createPassengerManifest({ ...valid, [key]: 'dato' }, context)).toThrow(
      BookingValidationError,
    );
  },
);

test('exige referencia de fecha explícita al componer cada pasajero', () => {
  expect(() => createPassengerManifest(valid)).toThrow(BookingValidationError);
});

test('no impone una prohibición de cédula repetida en asientos distintos', () => {
  const otherSeat = { ...first, seatId: '02' };
  expect(createPassengerManifest({ ...valid, passengers: [first, otherSeat] }, context)).toEqual([
    first,
    otherSeat,
  ]);
});

test('congela lista y pasajeros y conserva las entradas', () => {
  const result = createPassengerManifest(valid, context);
  expect(Object.isFrozen(result)).toBe(true);
  expect(result.every(Object.isFrozen)).toBe(true);
  expect(result[0]).not.toBe(first);
  expect(valid.passengers).toEqual([first, second]);
  expect(valid.seatIds).toEqual(['01', '02']);
  expect(() => result.push(first)).toThrow(TypeError);
});

test('un fallo al final no modifica los pasajeros anteriores', () => {
  const incomplete = Object.freeze({ ...second, birthDate: '2026-10-26' });
  const input = Object.freeze({ ...valid, passengers: Object.freeze([first, incomplete]) });
  expect(() => createPassengerManifest(input, context)).toThrow(BookingValidationError);
  expect(input.passengers[0]).toBe(first);
  expect(input.passengers[1]).toBe(incomplete);
});
