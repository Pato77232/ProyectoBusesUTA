const { parseTariffRequest, createDraftTariff } = require('./draft-tariff');
const {
  TariffValidationError,
  TariffConflictError,
  TariffSourceError,
} = require('../errors/route-tariff-errors');

function restoreTariffSnapshot(snapshot, revision) {
  if (
    !snapshot ||
    snapshot.schemaVersion !== 1 ||
    snapshot.currency !== 'USD' ||
    snapshot.policy?.discountStrategy !== 'MAX_ELIGIBLE' ||
    !Array.isArray(snapshot.frequencies)
  )
    throw new TariffSourceError();
  const { vipSurchargeBps, minorDiscountBps, seniorDiscountBps, disabilityDiscountBps } =
    snapshot.policy;
  const routes = new Map();
  const frequencies = Array.from(snapshot.frequencies, (entry) => {
    if (!entry || !Array.isArray(entry.routePoints) || entry.routePoints.length < 2)
      throw new TariffSourceError();
    const points = Array.from(entry.routePoints, (point) => {
      if (typeof point !== 'string' || !point.trim()) throw new TariffSourceError();
      return point.trim().normalize('NFC');
    });
    if (new Set(points.map((point) => point.toLowerCase())).size !== points.length)
      throw new TariffSourceError();
    routes.set(entry.frequencyId, points);
    return { frequencyId: entry.frequencyId, prices: entry.prices };
  });
  try {
    const request = parseTariffRequest({
      expectedRevision: revision - 1,
      policy: { vipSurchargeBps, minorDiscountBps, seniorDiscountBps, disabilityDiscountBps },
      frequencies,
    });
    return createDraftTariff(request, routes);
  } catch (error) {
    if (error instanceof TariffValidationError || error instanceof TariffConflictError)
      throw new TariffSourceError();
    throw error;
  }
}

module.exports = restoreTariffSnapshot;
