const {
  FrequencyValidationError,
  FrequencyRequiresAntResolutionError,
  FrequencySegmentPricesMismatchError,
} = require('./frequency-error');
const { createDepartureTime } = require('./departure-time');
const { createFrequencyStatus } = require('./frequency-status');
const { createStop, placeKey } = require('./stop');
const { createSegmentPrice } = require('./segment-price');

const FIELDS = [
  'origin',
  'destination',
  'departure_time',
  'ant_resolution_number',
  'status',
  'stops',
  'segment_prices',
];
// El servidor toma la cooperativa de la sesión: si llega en el cuerpo, se ignora (RN-02).
const IGNORED_FIELDS = ['cooperative_id'];
const NO_STOPS = Object.freeze([]);

function invalid() {
  throw new FrequencyValidationError();
}

function requiredPlace(value) {
  if (typeof value !== 'string' || !value.trim()) return invalid();
  return value.trim();
}

/** RN-21: la resolución ANT es obligatoria; el error es propio aunque el campo falte por completo. */
function requireAntResolutionNumber(value) {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
    throw new FrequencyRequiresAntResolutionError();
  }
  if (typeof value !== 'string') return invalid();
  return value.trim();
}

/** RN-22: paradas ordenadas, sin repetir lugares ni incluir el origen o el destino. */
function createStops(value, originKey, destinationKey) {
  if (value === undefined || value === null) return NO_STOPS;
  if (!Array.isArray(value)) return invalid();
  const stops = [];
  const seen = new Set();
  for (const item of value) {
    const stop = createStop(item);
    const key = placeKey(stop);
    if (key === originKey || key === destinationKey || seen.has(key)) return invalid();
    seen.add(key);
    stops.push(stop);
  }
  return Object.freeze(stops);
}

/** Un precio por tramo: la ruta con N paradas tiene N+1 tramos, en orden. */
function createSegmentPrices(value, segments) {
  if (!Array.isArray(value) || value.length !== segments) {
    throw new FrequencySegmentPricesMismatchError();
  }
  return Object.freeze(value.map((amount) => createSegmentPrice(amount)));
}

/**
 * Entidad `Frequency`: valida y normaliza los datos de una frecuencia nueva.
 * Devuelve un objeto congelado (RN-20: origen, destino y hora no se modifican después de crear).
 */
function createFrequency(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !FIELDS.includes(key) && !IGNORED_FIELDS.includes(key))
  ) {
    return invalid();
  }

  const antResolutionNumber = requireAntResolutionNumber(input.ant_resolution_number);
  const origin = requiredPlace(input.origin);
  const destination = requiredPlace(input.destination);
  const originKey = placeKey(origin);
  const destinationKey = placeKey(destination);
  if (originKey === destinationKey) return invalid();

  const stops = createStops(input.stops, originKey, destinationKey);

  return Object.freeze({
    origin,
    destination,
    departure_time: createDepartureTime(input.departure_time),
    ant_resolution_number: antResolutionNumber,
    status: createFrequencyStatus(input.status),
    stops,
    segment_prices: createSegmentPrices(input.segment_prices, stops.length + 1),
  });
}

module.exports = { createFrequency, FIELDS, IGNORED_FIELDS };
