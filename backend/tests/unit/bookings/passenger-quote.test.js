const {
  quotePassenger,
  ageOnDate,
} = require('../../../src/modules/bookings/domain/passenger-quote');
const { BookingValidationError } = require('../../../src/modules/bookings/domain/booking-error');

const valid = Object.freeze({
  segmentPricesCents: Object.freeze([300, 550]),
  birthDate: '1990-10-20',
  departureDate: '2026-10-20',
  disabilityVerified: false,
});

test('cobra tarifa regular a un adulto sin beneficio acreditado', () => {
  expect(quotePassenger(valid)).toEqual({
    currency: 'USD',
    basePriceCents: 850,
    discountPercent: 0,
    discountCents: 0,
    totalPriceCents: 850,
    eligibleCategories: [],
  });
});

test.each([
  ['2008-10-21', ['MINOR'], 425],
  ['2008-10-20', [], 850],
  ['1961-10-21', [], 850],
  ['1961-10-20', ['SENIOR'], 425],
])(
  'calcula beneficio en el cumpleaños de salida: %s',
  (birthDate, eligibleCategories, totalPriceCents) => {
    expect(quotePassenger({ ...valid, birthDate })).toMatchObject({
      totalPriceCents,
      eligibleCategories,
    });
  },
);

test('aplica discapacidad acreditada y no acumula con la tercera edad', () => {
  const result = quotePassenger({ ...valid, birthDate: '1950-01-01', disabilityVerified: true });
  expect(result.eligibleCategories).toEqual(['SENIOR', 'DISABILITY']);
  expect(result.discountPercent).toBe(50);
  expect(result.totalPriceCents).toBe(425);
});

test('aplica discapacidad a un adulto y no acumula con minoría de edad', () => {
  expect(quotePassenger({ ...valid, disabilityVerified: true }).totalPriceCents).toBe(425);
  expect(
    quotePassenger({ ...valid, birthDate: '2020-01-01', disabilityVerified: true }).totalPriceCents,
  ).toBe(425);
});

test('suma tramos antes de redondear una sola vez, conservando el desglose', () => {
  const result = quotePassenger({
    ...valid,
    segmentPricesCents: [101, 101],
    disabilityVerified: true,
  });
  expect(result.totalPriceCents).toBe(101);
  expect(result.discountCents + result.totalPriceCents).toBe(result.basePriceCents);
  expect(
    quotePassenger({ ...valid, segmentPricesCents: [101], disabilityVerified: true })
      .totalPriceCents,
  ).toBe(51);
});

test('no pierde precisión en el mayor entero admitido', () => {
  const result = quotePassenger({
    ...valid,
    segmentPricesCents: [Number.MAX_SAFE_INTEGER],
    disabilityVerified: true,
  });
  expect(result.totalPriceCents).toBe(4503599627370496);
  expect(result.discountCents + result.totalPriceCents).toBe(Number.MAX_SAFE_INTEGER);
});

test.each(
  [
    undefined,
    null,
    [],
    [0],
    [-1],
    [1.5],
    ['850'],
    [Infinity],
    [Number.MAX_SAFE_INTEGER, 1],
    Array(1),
  ].map((value) => [value]),
)('rechaza tarifas inválidas o desbordamientos: %j', (segmentPricesCents) => {
  expect(() => quotePassenger({ ...valid, segmentPricesCents })).toThrow(BookingValidationError);
});

test.each([undefined, null, 'false', 0])(
  'exige acreditación booleana explícita: %j',
  (disabilityVerified) => {
    expect(() => quotePassenger({ ...valid, disabilityVerified })).toThrow(BookingValidationError);
  },
);

test.each([undefined, null, '', '2026-02-30', '2025-02-29', '2026-2-01', '2026-10-20T00:00:00Z'])(
  'rechaza fechas locales inválidas: %j',
  (date) => {
    expect(() => ageOnDate(date, valid.departureDate)).toThrow(BookingValidationError);
    expect(() => ageOnDate(valid.birthDate, date)).toThrow(BookingValidationError);
  },
);

test('rechaza nacimiento futuro y calcula cumpleaños bisiesto sin zona horaria implícita', () => {
  expect(() => ageOnDate('2027-01-01', '2026-10-20')).toThrow(BookingValidationError);
  expect(ageOnDate('2008-02-29', '2026-02-28')).toBe(17);
  expect(ageOnDate('2008-02-29', '2026-03-01')).toBe(18);
});

test('congela la cotización y no altera tarifas ni datos de entrada', () => {
  const result = quotePassenger(valid);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.eligibleCategories)).toBe(true);
  expect(valid.segmentPricesCents).toEqual([300, 550]);
});
