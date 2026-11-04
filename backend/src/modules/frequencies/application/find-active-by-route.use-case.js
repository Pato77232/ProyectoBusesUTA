const { placeKey } = require('../domain/stop');

function normalizeRoute(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  return trimmed;
}

function findActiveByRouteUseCase({ repository }) {
  return async ({ origin, destination } = {}) => {
    const normalizedOrigin = normalizeRoute(origin);
    const normalizedDestination = normalizeRoute(destination);
    if (!normalizedOrigin || !normalizedDestination) {
      return [];
    }
    if (placeKey(normalizedOrigin) === placeKey(normalizedDestination)) {
      return [];
    }
    const frequencies = await repository.listAllActiveByRoute(
      normalizedOrigin,
      normalizedDestination,
    );
    return frequencies.map((frequency) => ({
      id: frequency.id,
      cooperative_id: frequency.cooperative_id,
      origin: frequency.origin,
      destination: frequency.destination,
      departure_time: frequency.departure_time,
      stops: frequency.stops,
      segment_prices: frequency.segment_prices,
    }));
  };
}

module.exports = findActiveByRouteUseCase;
