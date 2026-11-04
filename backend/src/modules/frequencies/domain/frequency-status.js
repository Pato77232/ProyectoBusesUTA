const { FrequencyValidationError } = require('./frequency-error');

/** Estados posibles de una frecuencia (RN-23). */
const FREQUENCY_STATUSES = Object.freeze(['ACTIVE', 'INACTIVE']);
const DEFAULT_STATUS = 'ACTIVE';

/** Value object: estado Activa/Inactiva. Ausente o nulo aplica el valor por defecto. */
function createFrequencyStatus(value) {
  const status = value === undefined || value === null ? DEFAULT_STATUS : value;
  if (!FREQUENCY_STATUSES.includes(status)) throw new FrequencyValidationError();
  return status;
}

module.exports = { FREQUENCY_STATUSES, DEFAULT_STATUS, createFrequencyStatus };
