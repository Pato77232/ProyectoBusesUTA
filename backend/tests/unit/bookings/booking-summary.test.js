const { createBookingSummary } = require('../../../src/modules/bookings/domain/booking-summary');
const { BookingValidationError } = require('../../../src/modules/bookings/domain/booking-error');
const { summaryInput, summaryContext } = require('./helpers/booking-summary-fixtures');

function freezeTree(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeTree);
    Object.freeze(value);
  }
  return value;
}

test('compone el tramo seleccionado, ordena pasajeros y suma el redondeo individual', () => {
  const summary = createBookingSummary(summaryInput(), summaryContext());
  expect(summary).toMatchObject({
    tripId: 'viaje-prueba',
    cooperativeId: 'cooperativa-prueba',
    fromPosition: 1,
    toPosition: 3,
    departureDate: '2026-10-28',
    currency: 'USD',
    totals: { basePriceCents: 1002, discountCents: 250, totalPriceCents: 752 },
  });
  expect(summary.passengers.map((passenger) => passenger.seatId)).toEqual(['01', '02']);
  expect(summary.passengers[0].quote).toMatchObject({
    basePriceCents: 501,
    totalPriceCents: 501,
    discountPercent: 0,
  });
  expect(summary.passengers[1].quote).toMatchObject({
    basePriceCents: 501,
    totalPriceCents: 251,
    eligibleCategories: ['MINOR'],
  });
  for (const field of ['bookingId', 'ownerId', 'status', 'createdAt', 'expiresAt'])
    expect(summary).not.toHaveProperty(field);
});

test('no acumula discapacidad acreditada con el descuento por edad', () => {
  const context = summaryContext();
  context.passengerBenefits[0].disabilityVerified = true;
  const summary = createBookingSummary(summaryInput(), context);
  expect(summary.passengers[1].quote).toMatchObject({
    eligibleCategories: ['MINOR', 'DISABILITY'],
    discountPercent: 50,
    totalPriceCents: 251,
  });
});

test('incluye tercera edad en la fecha de salida y suma cotizaciones', () => {
  const input = summaryInput();
  input.passengers[1].birthDate = '1961-10-28';
  const summary = createBookingSummary(input, summaryContext());
  expect(summary.passengers[0].quote.eligibleCategories).toEqual(['SENIOR']);
  expect(summary.totals).toEqual({
    basePriceCents: 1002,
    discountCents: 500,
    totalPriceCents: 502,
  });
});

test.each([
  'cooperativeId',
  'ownerId',
  'totalPriceCents',
  'discountPercent',
  'expiresAt',
  'status',
  'summaryAccepted',
])('rechaza el campo %s en la entrada del cliente', (field) => {
  expect(() =>
    createBookingSummary({ ...summaryInput(), [field]: 'inyectado' }, summaryContext()),
  ).toThrow(BookingValidationError);
});

test.each([undefined, null, [], {}].map((value) => [value]))(
  'rechaza consulta incompleta: %j',
  (input) => {
    expect(() => createBookingSummary(input, summaryContext())).toThrow(BookingValidationError);
  },
);

test.each([
  { tripId: 'otro-viaje' },
  { fromPosition: -1 },
  { fromPosition: 2.5 },
  { toPosition: 1 },
  { toPosition: 5 },
  { seatIds: ['01', '99'] },
  { seatIds: ['01', '01'] },
  { seatIds: [] },
  { passengers: [] },
])('rechaza recorrido, plantilla o pasajeros inválidos: %j', (change) => {
  expect(() => createBookingSummary({ ...summaryInput(), ...change }, summaryContext())).toThrow(
    BookingValidationError,
  );
});

test.each([
  { departureDate: '2026-10-26' },
  { departureDate: '2026-02-30' },
  { departureDate: null },
  { cooperativeId: '' },
  { segmentPricesCents: [100] },
  { segmentPricesCents: [99, 0, 301, 99] },
  { segmentPricesCents: [99, 200.5, 301, 99] },
  { segmentPricesCents: [99, 200, -1, 99] },
  { segmentPricesCents: [99, '200', 301, 99] },
  { segmentPricesCents: Array(4) },
])('rechaza contexto de viaje o tarifas inválido: %j', (change) => {
  const context = summaryContext();
  Object.assign(context.trip, change);
  expect(() => createBookingSummary(summaryInput(), context)).toThrow(BookingValidationError);
});

test.each(
  [
    undefined,
    null,
    [],
    [
      { seatId: '01', disabilityVerified: false },
      { seatId: '01', disabilityVerified: true },
    ],
    [
      { seatId: '01', disabilityVerified: false },
      { seatId: '99', disabilityVerified: false },
    ],
    [{ seatId: '01', disabilityVerified: false }, { seatId: '02' }],
    [
      { seatId: '01', disabilityVerified: false },
      { seatId: '02', disabilityVerified: 'true' },
    ],
    [null, { seatId: '02', disabilityVerified: false }],
  ].map((value) => [value]),
)('exige beneficios explícitos por cada asiento: %j', (passengerBenefits) => {
  expect(() =>
    createBookingSummary(summaryInput(), { ...summaryContext(), passengerBenefits }),
  ).toThrow(BookingValidationError);
});

test('rechaza desbordamiento de la base global aunque los totales con descuento quepan', () => {
  const context = summaryContext();
  context.trip.segmentPricesCents = [99, Number.MAX_SAFE_INTEGER - 1, 1, 99];
  expect(() => createBookingSummary(summaryInput(), context)).toThrow(BookingValidationError);
});

test('acepta salida en la fecha local actual y no necesita reloj global', () => {
  const context = summaryContext();
  context.trip.departureDate = context.onDate;
  expect(createBookingSummary(summaryInput(), context).departureDate).toBe(context.onDate);
});

test('no modifica entradas congeladas y congela todos los objetos del resumen', () => {
  const input = freezeTree(summaryInput());
  const context = freezeTree(summaryContext());
  const summary = createBookingSummary(input, context);
  expect(Object.isFrozen(summary)).toBe(true);
  expect(Object.isFrozen(summary.totals)).toBe(true);
  expect(Object.isFrozen(summary.passengers)).toBe(true);
  for (const passenger of summary.passengers) {
    expect(Object.isFrozen(passenger)).toBe(true);
    expect(Object.isFrozen(passenger.quote)).toBe(true);
    expect(Object.isFrozen(passenger.quote.eligibleCategories)).toBe(true);
  }
  expect(input.passengers[0].seatId).toBe('02');
});

test('no comparte datos mutables con el contexto o la entrada', () => {
  const input = summaryInput();
  const context = summaryContext();
  const summary = createBookingSummary(input, context);
  input.passengers[0].fullName = 'Cambio posterior';
  context.trip.segmentPricesCents[1] = 99999;
  context.passengerBenefits[0].disabilityVerified = true;
  expect(summary.passengers[1].fullName).toBe('Pasajera Menor');
  expect(summary.passengers[1].quote.eligibleCategories).toEqual(['MINOR']);
  expect(summary.totals.totalPriceCents).toBe(752);
});
