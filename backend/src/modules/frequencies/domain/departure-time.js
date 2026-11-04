const { FrequencyValidationError } = require('./frequency-error');

// Hora de 24 h con una o dos cifras en la hora y minutos de dos cifras; se normaliza a `HH:mm`.
const DEPARTURE_TIME_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** Value object: hora de salida válida en formato `HH:mm`. */
function createDepartureTime(value) {
  if (typeof value !== 'string') throw new FrequencyValidationError();
  const match = DEPARTURE_TIME_PATTERN.exec(value.trim());
  if (!match) throw new FrequencyValidationError();
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

module.exports = { createDepartureTime, DEPARTURE_TIME_PATTERN };
