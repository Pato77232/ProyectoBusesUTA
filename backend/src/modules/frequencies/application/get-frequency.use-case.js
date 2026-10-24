const { FrequencyError } = require('../domain/frequency-error');

function getFrequencyUseCase({ repository }) {
  return async (id, actor) => {
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
    return repository.findById(actor.cooperative_id, id);
  };
}

module.exports = getFrequencyUseCase;
module.exports.FrequencyError = require('../domain/frequency-error').FrequencyError;
