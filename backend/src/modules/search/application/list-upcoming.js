const request = require('../domain/upcoming-request');
const DomainError = require('../../../shared/errors/domain-error');

// SEARCH-02: sin fecha se muestran los próximos días; la lista se acota y avisa si hay más.
const UPCOMING_DAYS = 7;
const UPCOMING_LIMIT = 50;

const unavailable = () => {
  throw new DomainError(
    'No se pudo comprobar la oferta de viajes. Inténtalo de nuevo.',
    'SEARCH_UNAVAILABLE',
    503,
  );
};

function validTrip(trip, cooperativeName) {
  return (
    typeof cooperativeName === 'string' &&
    cooperativeName.trim() &&
    trip.currency === 'USD' &&
    Number.isSafeInteger(trip.amountCents) &&
    trip.amountCents > 0 &&
    Number.isSafeInteger(trip.stopCount) &&
    trip.stopCount >= 0
  );
}

module.exports =
  ({ tripSearch, cooperativeQueries }) =>
  async (input) => {
    let query;
    try {
      query = request(input);
    } catch {
      throw new DomainError(
        'La fecha o la cooperativa indicadas no son válidas.',
        'SEARCH_INVALID',
        400,
      );
    }
    try {
      const result = await tripSearch.findUpcoming({
        ...query,
        days: UPCOMING_DAYS,
        limit: UPCOMING_LIMIT,
      });
      if (!Array.isArray(result?.trips) || typeof result.truncated !== 'boolean') unavailable();
      const cooperatives = await cooperativeQueries.findByIds([
        ...new Set(result.trips.map((t) => t.cooperativeId)),
      ]);
      if (!Array.isArray(cooperatives)) unavailable();
      const names = new Map(cooperatives.map((c) => [c.id, c.name]));
      const trips = result.trips.map((trip) => {
        const cooperativeName = names.get(trip.cooperativeId);
        if (!validTrip(trip, cooperativeName)) unavailable();
        // Proyección explícita: ni asientos ni datos de compradores.
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
          stopCount: trip.stopCount,
          currency: 'USD',
          amountCents: trip.amountCents,
        };
      });
      trips.sort(
        (a, b) =>
          Date.parse(a.boardingAt) - Date.parse(b.boardingAt) || a.tripId.localeCompare(b.tripId),
      );
      return { trips, truncated: result.truncated, days: UPCOMING_DAYS };
    } catch (error) {
      if (error instanceof DomainError && error.code === 'SEARCH_UNAVAILABLE') throw error;
      unavailable();
    }
  };

module.exports.UPCOMING_DAYS = UPCOMING_DAYS;
module.exports.UPCOMING_LIMIT = UPCOMING_LIMIT;
