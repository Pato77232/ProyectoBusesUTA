const request = require('../domain/search-request');
const DomainError = require('../../../shared/errors/domain-error');
const unavailable = () => {
  throw new DomainError(
    'No se pudo comprobar la oferta de viajes. Inténtalo de nuevo.',
    'SEARCH_UNAVAILABLE',
    503,
  );
};
module.exports =
  ({ tripSearch, cooperativeQueries }) =>
  async (input) => {
    let query;
    try {
      query = request(input);
    } catch {
      throw new DomainError('Indica origen, destino y una fecha real.', 'SEARCH_INVALID', 400);
    }
    try {
      const result = await tripSearch.find(query);
      if (!Array.isArray(result?.trips) || typeof result.truncated !== 'boolean') unavailable();
      const cooperatives = await cooperativeQueries.findByIds([
        ...new Set(result.trips.map((t) => t.cooperativeId)),
      ]);
      if (!Array.isArray(cooperatives)) unavailable();
      const names = new Map(cooperatives.map((c) => [c.id, c.name]));
      const trips = result.trips.map((trip) => {
        const cooperativeName = names.get(trip.cooperativeId);
        if (
          typeof cooperativeName !== 'string' ||
          !cooperativeName.trim() ||
          trip.currency !== 'USD' ||
          !Number.isSafeInteger(trip.amountCents) ||
          trip.amountCents <= 0
        )
          unavailable();
        // Proyección explícita: una extensión del proveedor no filtra asientos ni PII.
        return {
          tripId: trip.tripId,
          cooperativeId: trip.cooperativeId,
          cooperativeName,
          fromPosition: trip.fromPosition,
          toPosition: trip.toPosition,
          boardingAt: trip.boardingAt,
          arrivalAt: trip.arrivalAt,
          origin: trip.origin,
          destination: trip.destination,
          currency: 'USD',
          amountCents: trip.amountCents,
        };
      });
      trips.sort(
        (a, b) =>
          Date.parse(a.boardingAt) - Date.parse(b.boardingAt) || a.tripId.localeCompare(b.tripId),
      );
      return { trips, truncated: result.truncated };
    } catch {
      unavailable();
    }
  };
