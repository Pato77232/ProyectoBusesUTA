const { TariffValidationError, TariffConflictError } = require('../errors/route-tariff-errors');

const MAX_AMOUNT_CENTS = 9_999_999_999;
const MAX_PERCENT_BPS = 10_000;
const MAX_EXPECTED_REVISION = 2_147_483_646;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POLICY_FIELDS = [
  'vipSurchargeBps',
  'minorDiscountBps',
  'seniorDiscountBps',
  'disabilityDiscountBps',
];

function assertUuid(value) {
  if (typeof value !== 'string' || !UUID.test(value))
    throw new TariffValidationError('Identificador inválido.');
  return value.toLowerCase();
}

function assertFields(value, fields) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((field) => !fields.includes(field)) ||
    fields.some((field) => !Object.hasOwn(value, field))
  ) {
    throw new TariffValidationError('Campos obligatorios ausentes o propiedades no permitidas.');
  }
}

function createPolicy(value) {
  assertFields(value, POLICY_FIELDS);
  const result = {};
  for (const field of POLICY_FIELDS) {
    const amount = value[field];
    if (!Number.isInteger(amount) || amount < 0 || amount > MAX_PERCENT_BPS) {
      throw new TariffValidationError(
        'Cada porcentaje debe ser entero entre 0 y 10000 puntos básicos.',
      );
    }
    result[field] = amount;
  }
  return Object.freeze({ ...result, discountStrategy: 'MAX_ELIGIBLE' });
}

function readPrice(value) {
  assertFields(value, ['fromPosition', 'toPosition', 'amountCents']);
  if (
    !Number.isSafeInteger(value.fromPosition) ||
    value.fromPosition < 0 ||
    !Number.isSafeInteger(value.toPosition) ||
    value.toPosition <= value.fromPosition ||
    !Number.isSafeInteger(value.amountCents) ||
    value.amountCents <= 0 ||
    value.amountCents > MAX_AMOUNT_CENTS
  ) {
    throw new TariffValidationError('Par de recorrido o importe en centavos inválido.');
  }
  return Object.freeze({
    fromPosition: value.fromPosition,
    toPosition: value.toPosition,
    amountCents: value.amountCents,
  });
}

function readFrequency(value) {
  assertFields(value, ['frequencyId', 'prices']);
  if (!Array.isArray(value.prices) || value.prices.length === 0)
    throw new TariffValidationError('Se requieren precios explícitos.');
  return Object.freeze({
    frequencyId: assertUuid(value.frequencyId),
    prices: Object.freeze(Array.from(value.prices, readPrice)),
  });
}

function parseTariffRequest(body) {
  assertFields(body, ['expectedRevision', 'policy', 'frequencies']);
  if (
    !Number.isInteger(body.expectedRevision) ||
    body.expectedRevision < 0 ||
    body.expectedRevision > MAX_EXPECTED_REVISION
  ) {
    throw new TariffValidationError('expectedRevision debe ser un entero válido no negativo.');
  }
  if (!Array.isArray(body.frequencies) || body.frequencies.length === 0)
    throw new TariffValidationError('Se requiere al menos una frecuencia.');
  const frequencies = Array.from(body.frequencies, readFrequency);
  if (new Set(frequencies.map(({ frequencyId }) => frequencyId)).size !== frequencies.length) {
    throw new TariffValidationError('La frecuencia está repetida en el tarifario.');
  }
  return Object.freeze({
    expectedRevision: body.expectedRevision,
    policy: createPolicy(body.policy),
    frequencies: Object.freeze(frequencies),
  });
}

function completePrices(prices, pointCount) {
  const pairs = new Set();
  for (const { fromPosition, toPosition } of prices) {
    const key = `${fromPosition}:${toPosition}`;
    if (toPosition >= pointCount || pairs.has(key))
      throw new TariffValidationError('Par duplicado o fuera del recorrido.');
    pairs.add(key);
  }
  if (prices.length !== (pointCount * (pointCount - 1)) / 2) {
    throw new TariffConflictError(
      'ROUTE_TARIFF_INCOMPLETE',
      'Faltan precios explícitos para combinaciones del recorrido.',
    );
  }
  return Object.freeze(
    [...prices].sort((a, b) => a.fromPosition - b.fromPosition || a.toPosition - b.toPosition),
  );
}

function createDraftTariff(request, routes) {
  const frequencies = request.frequencies
    .map((frequency) => {
      const route = routes.get(frequency.frequencyId);
      if (!route)
        throw new TariffConflictError(
          'ROUTE_TARIFF_FREQUENCY_MISMATCH',
          'El tarifario no coincide con las frecuencias asignadas.',
        );
      return Object.freeze({
        frequencyId: frequency.frequencyId,
        routePoints: Object.freeze([...route]),
        prices: completePrices(frequency.prices, route.length),
      });
    })
    .sort((a, b) => a.frequencyId.localeCompare(b.frequencyId));
  return Object.freeze({
    schemaVersion: 1,
    currency: 'USD',
    policy: request.policy,
    frequencies: Object.freeze(frequencies),
  });
}

module.exports = { parseTariffRequest, createDraftTariff, assertUuid, MAX_AMOUNT_CENTS };
