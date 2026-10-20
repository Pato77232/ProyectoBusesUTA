const { FrequencyError } = require('../domain/frequency-error');
const { createFrequencyStatus } = require('../domain/frequency-status');

function changeFrequencyStatusUseCase({ repository }) {
  return async (id, status, actor) => {
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
    const normalizedStatus = createFrequencyStatus(status);
    return repository.updateStatus(actor.cooperative_id, id, normalizedStatus);
  };
}

module.exports = changeFrequencyStatusUseCase;
module.exports.FrequencyError = require('../domain/frequency-error').FrequencyError;
