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
    if (normalizedStatus === 'INACTIVE') {
      if (typeof repository.withDeactivation !== 'function') {
        throw new FrequencyError('FREQUENCY_COMMITMENTS_UNAVAILABLE');
      }
      return repository.withDeactivation(actor.cooperative_id, id, (commitments) => {
        const flags = ['hasUnfinishedCycles', 'hasFutureServices', 'hasPassengers'];
        if (
          commitments?.verifiable !== true ||
          flags.some((flag) => typeof commitments[flag] !== 'boolean')
        ) {
          throw new FrequencyError('FREQUENCY_COMMITMENTS_UNAVAILABLE');
        }
        if (flags.some((flag) => commitments[flag])) {
          throw new FrequencyError('FREQUENCY_HAS_COMMITMENTS');
        }
      });
    }
    return repository.updateStatus(actor.cooperative_id, id, normalizedStatus);
  };
}

module.exports = changeFrequencyStatusUseCase;
module.exports.FrequencyError = require('../domain/frequency-error').FrequencyError;
