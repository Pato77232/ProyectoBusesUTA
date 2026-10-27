const FrequencyQueryPort = require('../../domain/ports/frequency-query-port');

class FrequencyQueryAdapter extends FrequencyQueryPort {
  constructor({ frequencyRepository }) {
    super();
    this.frequencyRepository = frequencyRepository;
  }

  async findActiveByCooperativeId(cooperativeId) {
    if (this.frequencyRepository.findActiveByCooperativeId) {
      return this.frequencyRepository.findActiveByCooperativeId(cooperativeId);
    }
    if (this.frequencyRepository.findActive) {
      return this.frequencyRepository.findActive(cooperativeId);
    }
    return [];
  }

  async findById(id, cooperativeId) {
    if (this.frequencyRepository.findById) {
      return this.frequencyRepository.findById(id, cooperativeId);
    }
    return null;
  }

  async findWithStops(frequencyId, cooperativeId) {
    if (this.frequencyRepository.findWithStops) {
      return this.frequencyRepository.findWithStops(frequencyId, cooperativeId);
    }
    return this.findById(frequencyId, cooperativeId);
  }
}

module.exports = FrequencyQueryAdapter;
