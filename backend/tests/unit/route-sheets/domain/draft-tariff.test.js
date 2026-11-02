const {
  parseTariffRequest,
  createDraftTariff,
  MAX_AMOUNT_CENTS,
} = require('../../../../src/modules/route-sheets/domain/value-objects/draft-tariff');
const {
  TariffValidationError,
  TariffConflictError,
} = require('../../../../src/modules/route-sheets/domain/errors/route-tariff-errors');

const frequencyId = '10000000-0000-4000-8000-000000000001';
const price = (fromPosition, toPosition, amountCents) => ({
  fromPosition,
  toPosition,
  amountCents,
});
const policy = () => ({
  vipSurchargeBps: 2500,
  minorDiscountBps: 5000,
  seniorDiscountBps: 5000,
  disabilityDiscountBps: 5000,
});
const body = () => ({
  expectedRevision: 0,
  policy: policy(),
  frequencies: [{ frequencyId, prices: [price(0, 1, 200), price(1, 2, 300), price(0, 2, 450)] }],
});
const routes = () => new Map([[frequencyId, ['Ambato', 'Latacunga', 'Quito']]]);

describe('Tarifario explícito de una hoja borrador', () => {
  test('conserva el precio Ambato–Quito independiente y ordena sin mutar entrada', () => {
    const input = body();
    const before = JSON.stringify(input);
    const result = createDraftTariff(parseTariffRequest(input), routes());
    expect(result).toMatchObject({
      schemaVersion: 1,
      currency: 'USD',
      policy: { discountStrategy: 'MAX_ELIGIBLE' },
    });
    expect(result.frequencies[0].prices).toEqual([
      price(0, 1, 200),
      price(0, 2, 450),
      price(1, 2, 300),
    ]);
    expect(JSON.stringify(input)).toBe(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.policy)).toBe(true);
    expect(Object.isFrozen(result.frequencies[0].routePoints)).toBe(true);
    expect(Object.isFrozen(result.frequencies[0].prices[0])).toBe(true);
    input.policy.vipSurchargeBps = 0;
    expect(result.policy.vipSurchargeBps).toBe(2500);
  });

  test('admite un precio en frecuencia directa y el máximo técnico', () => {
    const input = body();
    input.frequencies[0].prices = [price(0, 1, MAX_AMOUNT_CENTS)];
    expect(
      createDraftTariff(parseTariffRequest(input), new Map([[frequencyId, ['Ambato', 'Quito']]]))
        .frequencies[0].prices[0].amountCents,
    ).toBe(MAX_AMOUNT_CENTS);
  });

  test('cuatro puntos exigen seis precios explícitos', () => {
    const input = body();
    input.frequencies[0].prices.push(price(0, 3, 600), price(1, 3, 500), price(2, 3, 200));
    expect(
      createDraftTariff(parseTariffRequest(input), new Map([[frequencyId, ['A', 'B', 'C', 'D']]]))
        .frequencies[0].prices,
    ).toHaveLength(6);
  });

  test('rechaza matriz incompleta sin sumar tramos', () => {
    const input = body();
    input.frequencies[0].prices.pop();
    expect(() => createDraftTariff(parseTariffRequest(input), routes())).toThrow(
      TariffConflictError,
    );
  });

  test.each(['duplicate', 'outside'])('rechaza par %s aunque coincida la cantidad', (kind) => {
    const input = body();
    input.frequencies[0].prices[2] = kind === 'duplicate' ? price(0, 1, 450) : price(0, 3, 450);
    expect(() => createDraftTariff(parseTariffRequest(input), routes())).toThrow(
      TariffValidationError,
    );
  });

  test.each([0, -1, 1.5, '200', null, true, Infinity, MAX_AMOUNT_CENTS + 1])(
    'rechaza importe %s',
    (amountCents) => {
      const input = body();
      input.frequencies[0].prices[0].amountCents = amountCents;
      expect(() => parseTariffRequest(input)).toThrow(TariffValidationError);
    },
  );

  test.each([
    { fromPosition: -1 },
    { fromPosition: 0.5 },
    { toPosition: 0 },
    { toPosition: '1' },
    { extra: true },
  ])('rechaza coordenadas/campos inválidos %j', (change) => {
    const input = body();
    Object.assign(input.frequencies[0].prices[0], change);
    expect(() => parseTariffRequest(input)).toThrow(TariffValidationError);
  });

  test.each([0, 1, 125, 10000])('acepta porcentaje explícito de %s puntos básicos', (value) => {
    const input = body();
    for (const field of Object.keys(input.policy)) input.policy[field] = value;
    expect(parseTariffRequest(input).policy.vipSurchargeBps).toBe(value);
  });

  test.each([-1, 10001, 1.5, '100', null, undefined, true])('rechaza porcentaje %s', (value) => {
    const input = body();
    input.policy.minorDiscountBps = value;
    expect(() => parseTariffRequest(input)).toThrow(TariffValidationError);
  });

  test.each([
    undefined,
    null,
    [],
    {},
    { ...body(), cooperativeId: 'elegida' },
    { ...body(), expectedRevision: -1 },
    { ...body(), expectedRevision: 0.5 },
    { ...body(), expectedRevision: 2147483647 },
    { ...body(), frequencies: [] },
    { ...body(), policy: {} },
  ])('rechaza estructura inválida %#', (input) => {
    expect(() => parseTariffRequest(input)).toThrow(TariffValidationError);
  });

  test('rechaza frecuencia duplicada e identidad inválida', () => {
    const input = body();
    input.frequencies.push(input.frequencies[0]);
    expect(() => parseTariffRequest(input)).toThrow(TariffValidationError);
    input.frequencies = [{ ...input.frequencies[0], frequencyId: 'inventada' }];
    expect(() => parseTariffRequest(input)).toThrow(TariffValidationError);
  });
});
