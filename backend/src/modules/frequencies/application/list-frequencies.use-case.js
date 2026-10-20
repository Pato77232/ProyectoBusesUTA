const { FrequencyError } = require('../domain/frequency-error');
const { createFrequencyStatus } = require('../domain/frequency-status');

function normalizeText(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new FrequencyError('VALIDATION_ERROR');
  }
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  return trimmed;
}

function listFrequenciesUseCase({ repository }) {
  return async (filters = {}, actor) => {
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
    const normalizedFilters = {};
    if (filters.status !== undefined) {
      normalizedFilters.status = createFrequencyStatus(filters.status);
    }
    const origin = normalizeText(filters.origin);
    if (origin !== undefined) {
      normalizedFilters.origin = origin;
    }
    const destination = normalizeText(filters.destination);
    if (destination !== undefined) {
      normalizedFilters.destination = destination;
    }
    return repository.list(actor.cooperative_id, normalizedFilters);
  };
}

module.exports = listFrequenciesUseCase;
module.exports.FrequencyError = require('../domain/frequency-error').FrequencyError;
