const { createFrequency } = require('../domain/frequency');
const { FrequencyError } = require('../domain/frequency-error');

function createFrequencyUseCase({ repository }) {
  return async (input, actor) => {
    if (!actor || actor.role !== 'COOPERATIVE_ADMIN') {
      const error = new FrequencyError('FORBIDDEN');
      error.name = 'FrequencyError';
      throw error;
    }
    if (!actor.cooperative_id) {
      const error = new FrequencyError('FORBIDDEN');
      error.name = 'FrequencyError';
      throw error;
    }
    const frequencyData = createFrequency(input);
    return repository.create(actor.cooperative_id, frequencyData);
  };
}

module.exports = createFrequencyUseCase;
module.exports.FrequencyError = require('../domain/frequency-error').FrequencyError;
