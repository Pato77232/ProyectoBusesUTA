const {
  listSeatAvailability,
  rangesOverlap,
} = require('../../../src/modules/bookings/domain/seat-availability');
const { BookingValidationError } = require('../../../src/modules/bookings/domain/booking-error');

const query = Object.freeze({
  tripId: 'viaje-1',
  cooperativeId: 'cooperativa-1',
  fromPosition: 1,
  toPosition: 3,
});
const allocation = Object.freeze({ ...query, seatId: '01', status: 'RESERVED' });

test('sin ocupaciones devuelve asientos disponibles sin datos personales', () => {
  const result = listSeatAvailability({ query, seatIds: ['01', '02'], allocations: [] });
  expect(result).toEqual([
    { seatId: '01', status: 'AVAILABLE' },
    { seatId: '02', status: 'AVAILABLE' },
  ]);
});

test.each(['RESERVED', 'SOLD'])('el asiento %s bloquea un tramo superpuesto', (status) => {
  const result = listSeatAvailability({
    query,
    seatIds: ['01', '02'],
    allocations: [{ ...allocation, status }],
  });
  expect(result).toEqual([
    { seatId: '01', status },
    { seatId: '02', status: 'AVAILABLE' },
  ]);
});

test.each([
  { fromPosition: 0, toPosition: 1 },
  { fromPosition: 3, toPosition: 4 },
  { tripId: 'viaje-2' },
  { cooperativeId: 'cooperativa-2' },
  { seatId: '99' },
])('no bloquea ocupaciones ajenas al recorrido consultado: %j', (change) => {
  const result = listSeatAvailability({
    query,
    seatIds: ['01'],
    allocations: [{ ...allocation, ...change }],
  });
  expect(result[0].status).toBe('AVAILABLE');
});

test.each([
  [0, 2],
  [2, 4],
  [0, 4],
  [1, 2],
  [1, 3],
])('detecta solapamiento desde %i hasta %i en ambos sentidos', (fromPosition, toPosition) => {
  const other = { fromPosition, toPosition };
  expect(rangesOverlap(query, other)).toBe(true);
  expect(rangesOverlap(other, query)).toBe(true);
});

test.each([
  undefined,
  null,
  {},
  { ...query, fromPosition: -1 },
  { ...query, fromPosition: 1.5 },
  { ...query, toPosition: 1 },
  { ...query, toPosition: Infinity },
  { ...query, toPosition: Number.MAX_SAFE_INTEGER + 1 },
  { ...query, tripId: '' },
  { ...query, cooperativeId: null },
])('rechaza un contexto de consulta inválido: %j', (invalidQuery) => {
  expect(() =>
    listSeatAvailability({ query: invalidQuery, seatIds: ['01'], allocations: [] }),
  ).toThrow(BookingValidationError);
});

test.each([['01', '01'], [''], [1]])('rechaza inventario inválido: %j', (...seatIds) => {
  expect(() => listSeatAvailability({ query, seatIds, allocations: [] })).toThrow(
    BookingValidationError,
  );
});

test.each([null, {}, { ...allocation, status: 'AVAILABLE' }, { ...allocation, seatId: '' }])(
  'rechaza ocupación inválida: %j',
  (invalidAllocation) => {
    expect(() =>
      listSeatAvailability({ query, seatIds: ['01'], allocations: [invalidAllocation] }),
    ).toThrow(BookingValidationError);
  },
);

test('preserva el inventario y congela el resultado; vendido predomina sin importar el orden', () => {
  const seatIds = Object.freeze(['01']);
  const sold = Object.freeze({ ...allocation, status: 'SOLD' });
  for (const allocations of [
    Object.freeze([sold, allocation]),
    Object.freeze([allocation, sold]),
  ]) {
    const result = listSeatAvailability({ query, seatIds, allocations });
    expect(result).toEqual([{ seatId: '01', status: 'SOLD' }]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result[0])).toBe(true);
    expect(allocations).toHaveLength(2);
  }
});

test('exige listas explícitas y acepta inventario vacío', () => {
  expect(() => listSeatAvailability({ query, seatIds: [] })).toThrow(BookingValidationError);
  expect(() => listSeatAvailability({ query, allocations: [] })).toThrow(BookingValidationError);
  expect(listSeatAvailability({ query, seatIds: [], allocations: [] })).toEqual([]);
});
