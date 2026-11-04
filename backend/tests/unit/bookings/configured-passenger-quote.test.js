const {
  quoteConfiguredPassenger: quote,
} = require('../../../src/modules/bookings/domain/configured-passenger-quote');
const { BookingValidationError } = require('../../../src/modules/bookings/domain/booking-error');

function input(overrides = {}) {
  return {
    basePriceCents: 1000,
    seatCategory: 'NORMAL',
    boardingDate: '2026-11-02',
    passenger: { birthDate: '1990-01-01', disabilityVerified: false },
    policy: {
      vipSurchargeBps: 2500,
      minorDiscountBps: 3000,
      seniorDiscountBps: 4000,
      disabilityDiscountBps: 5000,
      discountStrategy: 'MAX_ELIGIBLE',
    },
    ...overrides,
  };
}

function expectExact(actual, decimal) {
  const [whole, fraction = ''] = decimal.split('.');
  const scale = 10n ** BigInt(fraction.length);
  const numerator = BigInt(whole + fraction);
  expect(BigInt(actual.numerator) * scale).toBe(numerator * BigInt(actual.denominator));
  expect(BigInt(actual.denominator)).toBeGreaterThan(0n);
}

// Expectativas de C01–C24 escritas en la tabla documental antes de este servicio.
const cases = [
  ['C01', 1000, 0, 0, '0', '0', '1000', 1000],
  ['C02', 1000, 2500, 0, '250', '0', '1250', 1250],
  ['C03', 450, 2500, 0, '112.5', '0', '562.5', 563],
  ['C04', 450, 2500, 5000, '112.5', '281.25', '281.25', 281],
  ['C05', 1000, 0, 3000, '0', '300', '700', 700],
  ['C06', 1000, 2500, 3000, '250', '375', '875', 875],
  ['C07', 1, 0, 5000, '0', '0.5', '0.5', 1],
  ['C08', 1, 0, 5001, '0', '0.5001', '0.4999', 0],
  ['C09', 1, 0, 4999, '0', '0.4999', '0.5001', 1],
  ['C10', 1000, 0, 10000, '0', '1000', '0', 0],
  ['C11', 1000, 10000, 10000, '1000', '2000', '0', 0],
  ['C12', 1000, 10000, 0, '1000', '0', '2000', 2000],
  ['C13', 1000, 0, 0, '0', '0', '1000', 1000],
  ['C14', 10000, 125, 1234, '125', '1249.425', '8875.575', 8876],
  ['C15', 100, 3333, 3333, '33.33', '44.438889', '88.891111', 89],
  ['C16', 1000, 0, 4000, '0', '400', '600', 600],
  ['C17', 1000, 0, 4000, '0', '400', '600', 600],
  ['C18', 1000, 2500, 4000, '250', '500', '750', 750],
  ['C19', 1000, 2500, 6000, '250', '750', '500', 500],
  ['C20', 450, 0, 0, '0', '0', '450', 450],
  ['C21', 1000, 2500, 3000, '250', '375', '875', 875],
  ['C22', 1000, 1000, 4000, '100', '440', '660', 660],
  ['C23', 9999999999, 10000, 0, '9999999999', '0', '19999999998', 19999999998],
  [
    'C24',
    9999999999,
    9999,
    9999,
    '9998999999.0001',
    '19997000098.00029999',
    '1999899.99980001',
    1999900,
  ],
];

test.each(cases)(
  '%s conserva componentes exactos y redondeo final',
  (_id, base, vip, discount, surcharge, benefit, exact, total) => {
    const request = input();
    request.basePriceCents = base;
    request.seatCategory = vip > 0 || _id === 'C13' ? 'VIP' : 'NORMAL';
    request.policy.vipSurchargeBps = vip;
    request.policy.disabilityDiscountBps = discount;
    request.passenger.disabilityVerified = discount > 0;
    const result = quote(request);
    expect(result.currency).toBe('USD');
    expect(result.totalPriceCents).toBe(total);
    expectExact(result.vipSurchargeExactCents, surcharge);
    expectExact(result.discountExactCents, benefit);
    expectExact(result.totalExactCents, exact);
    const r = result.roundingAdjustmentCents;
    const t = result.totalExactCents;
    expect(
      BigInt(t.numerator) * BigInt(r.denominator) + BigInt(r.numerator) * BigInt(t.denominator),
    ).toBe(BigInt(total) * BigInt(t.denominator) * BigInt(r.denominator));
  },
);

test.each([
  ['2008-11-02', '2026-11-01', ['MINOR'], 700],
  ['2008-11-02', '2026-11-02', [], 1000],
  ['2008-11-02', '2026-11-03', [], 1000],
  ['1961-11-02', '2026-11-01', [], 1000],
  ['1961-11-02', '2026-11-02', ['SENIOR'], 600],
  ['1961-11-02', '2026-11-03', ['SENIOR'], 600],
  ['2008-02-29', '2026-02-28', ['MINOR'], 700],
  ['2008-02-29', '2026-03-01', [], 1000],
])('edad acreditada %s al embarcar %s', (birthDate, boardingDate, categories, total) => {
  const result = quote(
    input({ boardingDate, passenger: { birthDate, disabilityVerified: false } }),
  );
  expect(result.eligibleCategories).toEqual(categories);
  expect(result.totalPriceCents).toBe(total);
});

test('aplica el máximo sin acumular y conserva todas las categorías empatadas', () => {
  const request = input({ passenger: { birthDate: '2010-01-01', disabilityVerified: true } });
  expect(quote(request)).toMatchObject({
    eligibleCategories: ['MINOR', 'DISABILITY'],
    appliedBenefitCategories: ['DISABILITY'],
    discountBps: 5000,
    totalPriceCents: 500,
  });
  request.policy.minorDiscountBps = 5000;
  expect(quote(request)).toMatchObject({
    appliedBenefitCategories: ['MINOR', 'DISABILITY'],
    totalPriceCents: 500,
  });
  request.passenger.birthDate = '1950-01-01';
  request.policy.seniorDiscountBps = 5000;
  expect(quote(request).appliedBenefitCategories).toEqual(['SENIOR', 'DISABILITY']);
});

test('distingue cero explícito con elegibilidad de ausencia de beneficios', () => {
  const request = input({ passenger: { birthDate: '2010-01-01', disabilityVerified: true } });
  request.policy.minorDiscountBps = 0;
  request.policy.disabilityDiscountBps = 0;
  expect(quote(request)).toMatchObject({
    eligibleCategories: ['MINOR', 'DISABILITY'],
    appliedBenefitCategories: ['MINOR', 'DISABILITY'],
    discountBps: 0,
    totalPriceCents: 1000,
  });
  expect(quote(input())).toMatchObject({
    eligibleCategories: [],
    appliedBenefitCategories: [],
    discountBps: 0,
  });
});

test('NORMAL no recibe recargo VIP y los ajustes racionales conservan su signo', () => {
  expect(quote(input())).toMatchObject({ vipSurchargeBps: 0, totalPriceCents: 1000 });
  const request = input({ basePriceCents: 450, seatCategory: 'VIP' });
  expect(quote(request).roundingAdjustmentCents).toEqual({ numerator: '1', denominator: '2' });
  request.passenger.disabilityVerified = true;
  expect(quote(request).roundingAdjustmentCents).toEqual({ numerator: '-1', denominator: '4' });
});

test('políticas de hojas diferentes se calculan sin mutar ni reescribir la primera', () => {
  const first = input({
    seatCategory: 'VIP',
    passenger: { birthDate: '2010-01-01', disabilityVerified: false },
  });
  const snapshot = JSON.stringify(first);
  const frozen = quote(first);
  const second = {
    ...first,
    policy: { ...first.policy, vipSurchargeBps: 1000, minorDiscountBps: 4000 },
  };
  expect(frozen.totalPriceCents).toBe(875);
  expect(quote(second).totalPriceCents).toBe(660);
  expect(frozen.totalPriceCents).toBe(875);
  expect(JSON.stringify(first)).toBe(snapshot);
  expect(JSON.parse(JSON.stringify(frozen))).toEqual(frozen);
  [
    frozen,
    frozen.eligibleCategories,
    frozen.appliedBenefitCategories,
    frozen.vipSurchargeExactCents,
    frozen.discountExactCents,
    frozen.totalExactCents,
    frozen.roundingAdjustmentCents,
  ].forEach((value) => expect(Object.isFrozen(value)).toBe(true));
});

test('cada pasajero redondea antes de sumar y usa la tarifa explícita única', () => {
  const request = input({
    basePriceCents: 1,
    passenger: { birthDate: '1990-01-01', disabilityVerified: true },
  });
  expect(quote(request).totalPriceCents + quote(request).totalPriceCents).toBe(2);
  expect(quote(input({ basePriceCents: 450 })).totalPriceCents).toBe(450);
  expect(() => quote(input({ basePriceCents: [200, 300] }))).toThrow(BookingValidationError);
});

test.each([
  0,
  -1,
  1.5,
  10000000000,
  Number.MAX_SAFE_INTEGER,
  NaN,
  Infinity,
  '450',
  null,
  undefined,
])('rechaza base inválida %s', (basePriceCents) => {
  expect(() => quote(input({ basePriceCents }))).toThrow(BookingValidationError);
});

test.each(['vipSurchargeBps', 'minorDiscountBps', 'seniorDiscountBps', 'disabilityDiscountBps'])(
  'exige porcentaje explícito y válido: %s',
  (key) => {
    for (const value of [-1, 10001, 1.25, NaN, Infinity, '5000', null, undefined]) {
      const request = input();
      request.policy[key] = value;
      expect(() => quote(request)).toThrow(BookingValidationError);
    }
    const request = input();
    delete request.policy[key];
    expect(() => quote(request)).toThrow(BookingValidationError);
  },
);

test.each([
  { seatCategory: 'ACCESSIBLE' },
  { seatCategory: undefined },
  { boardingDate: '2026-11-02T05:00:00Z' },
  { boardingDate: '2026-02-30' },
  { passenger: { birthDate: '2027-01-01', disabilityVerified: false } },
  { passenger: { birthDate: '2008-02-30', disabilityVerified: false } },
  { passenger: { birthDate: '1990-01-01' } },
  { passenger: { birthDate: '1990-01-01', disabilityVerified: 'true' } },
  { passenger: { birthDate: '1990-01-01', disabilityVerified: false, ownerId: 'cliente' } },
  { policy: null },
  { policy: { discountStrategy: 'SUM' } },
  { priceFromBrowser: 1 },
])('rechaza entrada incompleta o ajena al contrato: %j', (override) => {
  expect(() => quote(input(override))).toThrow(BookingValidationError);
});

test.each([undefined, null, [], 'precio'])('rechaza contenedor inválido %j', (value) => {
  expect(() => quote(value)).toThrow(BookingValidationError);
});

test('rechaza estrategia no autorizada y campos extra de política', () => {
  const request = input();
  request.policy.discountStrategy = 'SUM';
  expect(() => quote(request)).toThrow(BookingValidationError);
  request.policy.discountStrategy = 'MAX_ELIGIBLE';
  request.policy.other = 0;
  expect(() => quote(request)).toThrow(BookingValidationError);
});
