const { TariffConflictError, TariffSourceError } = require('../errors/route-tariff-errors');

function tariffRoutePoints(detail, frequencyId, cooperativeId) {
  if (!detail)
    throw new TariffConflictError(
      'ROUTE_TARIFF_FREQUENCY_MISMATCH',
      'La frecuencia no está disponible en la cooperativa.',
    );
  if (
    detail.id !== frequencyId ||
    detail.cooperativeId !== cooperativeId ||
    !Array.isArray(detail.stops)
  )
    throw new TariffSourceError();
  if (detail.status !== 'ACTIVE')
    throw new TariffConflictError(
      'ROUTE_TARIFF_FREQUENCY_INACTIVE',
      'La frecuencia debe estar activa.',
    );
  const points = [detail.origin, ...detail.stops, detail.destination];
  if (points.some((point) => typeof point !== 'string' || !point.trim()))
    throw new TariffSourceError();
  const normalized = points.map((point) => point.trim().normalize('NFC'));
  if (new Set(normalized.map((point) => point.toLowerCase())).size !== normalized.length)
    throw new TariffSourceError();
  return normalized;
}

module.exports = tariffRoutePoints;
