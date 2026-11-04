const { FrequencyValidationError } = require('./frequency-error');

/** Clave de comparación de lugares: sin espacios exteriores y sin distinguir mayúsculas. */
function placeKey(place) {
  return place.trim().toLowerCase();
}

/** Value object: parada intermedia autorizada, no vacía (RN-22). */
function createStop(value) {
  if (typeof value !== 'string' || !value.trim()) throw new FrequencyValidationError();
  return value.trim();
}

module.exports = { createStop, placeKey };
