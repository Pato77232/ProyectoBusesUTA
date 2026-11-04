const quote = require('../../../src/modules/bookings/domain/commercial-passenger-quote');
const policy = {
  discountStrategy: 'MAX_ELIGIBLE',
  vipSurchargeBps: 2500,
  minorDiscountBps: 5000,
  seniorDiscountBps: 3000,
  disabilityDiscountBps: 5000,
};
const base = {
  amountCents: 450,
  policy,
  category: 'NORMAL',
  birthDate: '1990-01-01',
  departureDate: '2030-01-02',
  disabilityVerified: false,
};
test.each([
  [{}, 450],
  [{ category: 'VIP' }, 563],
  [{ category: 'VIP', birthDate: '2015-01-01' }, 281],
  [{ amountCents: 1, birthDate: '2015-01-01' }, 1],
  [{ birthDate: '1960-01-01' }, 315],
  [{ disabilityVerified: true }, 225],
])('calcula una vez el total final: %j', (changes, expected) => {
  const result = quote({ ...base, ...changes });
  expect(result.totalPriceCents).toBe(expected);
  expect(
    result.basePriceCents +
      result.vipSurchargeCents -
      result.discountCents +
      result.roundingAdjustmentCents,
  ).toBe(expected);
});
test('VIP antes del beneficio conserva fracciones exactas y ajuste explícito', () => {
  const result = quote({ ...base, category: 'VIP', birthDate: '2015-01-01' });
  expect(result.exact).toEqual({
    denominator: '100000000',
    vipSurchargeNumerator: '11250000000',
    discountNumerator: '28125000000',
    totalNumerator: '28125000000',
  });
  expect(result.roundingAdjustmentCents).toBe(-1);
});
test('aplica el mayor beneficio una vez y conserva todos los empates', () => {
  const result = quote({ ...base, birthDate: '2015-01-01', disabilityVerified: true });
  expect(result.totalPriceCents).toBe(225);
  expect(result.appliedCategories).toEqual(['MINOR', 'DISABILITY']);
});
test('no presenta una categoría inferior como empatada', () => {
  const result = quote({ ...base, birthDate: '1960-01-01', disabilityVerified: true });
  expect(result.eligibleCategories).toEqual(['SENIOR', 'DISABILITY']);
  expect(result.appliedCategories).toEqual(['DISABILITY']);
});
test('cero explícito conserva elegibilidad sin inventar reducción', () => {
  const result = quote({
    ...base,
    birthDate: '2015-01-01',
    policy: { ...policy, minorDiscountBps: 0 },
  });
  expect(result.totalPriceCents).toBe(450);
  expect(result.eligibleCategories).toEqual(['MINOR']);
  expect(result.discountBps).toBe(0);
});
test('100 % permite cotizar cero y los importes máximos no pierden precisión', () => {
  expect(
    quote({
      ...base,
      disabilityVerified: true,
      policy: { ...policy, disabilityDiscountBps: 10000 },
    }).totalPriceCents,
  ).toBe(0);
  expect(
    quote({
      ...base,
      amountCents: 9_999_999_999,
      category: 'VIP',
      policy: { ...policy, vipSurchargeBps: 10000 },
    }).totalPriceCents,
  ).toBe(19_999_999_998);
});
test.each(['2012-01-03', '2012-01-02', '1965-01-03', '1965-01-02'])(
  'edad en la fecha de embarque elegida: %s',
  (birthDate) => {
    const result = quote({ ...base, birthDate });
    expect(result.eligibleCategories).toEqual(
      birthDate === '2012-01-03' ? ['MINOR'] : birthDate === '1965-01-02' ? ['SENIOR'] : [],
    );
  },
);
test.each([
  { amountCents: 0 },
  { amountCents: 10_000_000_000 },
  { category: 'DESCONOCIDA' },
  { disabilityVerified: undefined },
  { policy: { ...policy, minorDiscountBps: 1.5 } },
  { policy: { ...policy, vipSurchargeBps: 10001 } },
])('rechaza configuración inválida: %j', (changes) => {
  expect(() => quote({ ...base, ...changes })).toThrow();
});
