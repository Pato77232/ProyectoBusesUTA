const {
  parseTariffRequest,
  createDraftTariff,
} = require('../../domain/value-objects/draft-tariff');
const routePoints = require('../../domain/value-objects/tariff-route-points');
const {
  TariffConflictError,
  TariffSourceError,
} = require('../../domain/errors/route-tariff-errors');

async function validateTariffForPublication({ sheet, frequencyIds, frequencyQueryPort }) {
  const draft = sheet.tariff_draft;
  if (!draft || sheet.tariff_revision < 1)
    throw new TariffConflictError(
      'ROUTE_TARIFF_REQUIRED',
      'Configura el tarifario completo antes de publicar.',
    );
  if (
    draft.schemaVersion !== 1 ||
    draft.currency !== 'USD' ||
    draft.policy?.discountStrategy !== 'MAX_ELIGIBLE' ||
    !Array.isArray(draft.frequencies)
  )
    throw new TariffSourceError();
  const { vipSurchargeBps, minorDiscountBps, seniorDiscountBps, disabilityDiscountBps } =
    draft.policy;
  const request = parseTariffRequest({
    expectedRevision: sheet.tariff_revision - 1,
    policy: { vipSurchargeBps, minorDiscountBps, seniorDiscountBps, disabilityDiscountBps },
    frequencies: draft.frequencies.map(({ frequencyId, prices }) => ({ frequencyId, prices })),
  });
  const assigned = new Set(frequencyIds);
  if (
    assigned.size !== request.frequencies.length ||
    request.frequencies.some(({ frequencyId }) => !assigned.has(frequencyId))
  ) {
    throw new TariffConflictError(
      'ROUTE_TARIFF_FREQUENCY_MISMATCH',
      'Las asignaciones cambiaron; vuelve a configurar el tarifario.',
    );
  }
  if (typeof frequencyQueryPort?.findWithStops !== 'function') throw new TariffSourceError();
  const routes = new Map();
  for (const { frequencyId } of request.frequencies) {
    const detail = await frequencyQueryPort.findWithStops(frequencyId, sheet.cooperative_id);
    routes.set(frequencyId, routePoints(detail, frequencyId, sheet.cooperative_id));
  }
  const validated = createDraftTariff(request, routes);
  for (const frequency of validated.frequencies) {
    const stored = draft.frequencies.find(
      ({ frequencyId }) => frequencyId === frequency.frequencyId,
    );
    if (
      !Array.isArray(stored.routePoints) ||
      JSON.stringify(stored.routePoints) !== JSON.stringify(frequency.routePoints)
    ) {
      throw new TariffConflictError(
        'ROUTE_TARIFF_ROUTE_CHANGED',
        'El recorrido cambió; vuelve a configurar sus precios explícitos.',
      );
    }
  }
  return validated;
}

module.exports = validateTariffForPublication;
