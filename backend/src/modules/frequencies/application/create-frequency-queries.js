const { FrequencyNotFoundError } = require('../domain/frequency-error');

function toSummary(frequency) {
  return {
    id: frequency.id,
    cooperativeId: frequency.cooperative_id,
    origin: frequency.origin,
    destination: frequency.destination,
    departureTime: frequency.departure_time,
    antResolutionNumber: frequency.ant_resolution_number,
    status: frequency.status,
  };
}

function createFrequencyQueries({ repository }) {
  return Object.freeze({
    async findById(id, cooperativeId) {
      try {
        return toSummary(await repository.findById(cooperativeId, id));
      } catch (error) {
        if (error instanceof FrequencyNotFoundError) return null;
        throw error;
      }
    },

    async findActiveByCooperativeId(cooperativeId) {
      const frequencies = await repository.list(cooperativeId, { status: 'ACTIVE' });
      return frequencies.map(toSummary);
    },

    async findWithStops(id, cooperativeId) {
      try {
        const frequency = await repository.findById(cooperativeId, id);
        return { ...toSummary(frequency), stops: frequency.stops };
      } catch (error) {
        if (error instanceof FrequencyNotFoundError) return null;
        throw error;
      }
    },
  });
}

module.exports = createFrequencyQueries;
