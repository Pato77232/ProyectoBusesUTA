const FrequencyQueryPort = require('../../domain/ports/frequency-query-port');

class FrequencyQueryAdapter extends FrequencyQueryPort {
  constructor({ frequencyQueries }) {
    super();
    const requiredMethods = ['findActiveByCooperativeId', 'findById', 'findWithStops'];
    const missingMethods = requiredMethods.filter(
      (method) => typeof frequencyQueries?.[method] !== 'function',
    );

    if (missingMethods.length > 0) {
      throw new TypeError(`frequencyQueries requiere: ${missingMethods.join(', ')}.`);
    }

    this.frequencyQueries = frequencyQueries;
  }

  async findActiveByCooperativeId(cooperativeId) {
    return this.frequencyQueries.findActiveByCooperativeId(cooperativeId);
  }

  async findById(id, cooperativeId) {
    return this.frequencyQueries.findById(id, cooperativeId);
  }

  async findWithStops(frequencyId, cooperativeId) {
    return this.frequencyQueries.findWithStops(frequencyId, cooperativeId);
  }
}

module.exports = FrequencyQueryAdapter;
