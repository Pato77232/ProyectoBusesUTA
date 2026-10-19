const { FrequencyValidationError } = require('./frequency-error');

const DECIMAL_FACTOR = 100;
// Coincide con `numeric(10,2)` de la tabla frequency_segment_prices.
const MAX_SEGMENT_PRICE = 99999999.99;

/** Value object: precio de un tramo, mayor que cero y con máximo dos decimales. */
function createSegmentPrice(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new FrequencyValidationError();
  }
  if (value > MAX_SEGMENT_PRICE) throw new FrequencyValidationError();
  if (Math.round(value * DECIMAL_FACTOR) / DECIMAL_FACTOR !== value) {
    throw new FrequencyValidationError();
  }
  return value;
}

module.exports = { createSegmentPrice, MAX_SEGMENT_PRICE };
