const BusGroupError = require('./bus-group-error');

const FIELDS = ['name', 'category'];
const CATEGORIES = ['LONG_ROUTE', 'CANTONAL', 'URBAN_RURAL'];

function invalid() {
  throw new BusGroupError('VALIDATION_ERROR');
}

function createBusGroupData(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !FIELDS.includes(key))
  ) {
    return invalid();
  }
  if (typeof input.name !== 'string' || !input.name.trim()) {
    return invalid();
  }
  if (typeof input.category !== 'string' || !CATEGORIES.includes(input.category.trim())) {
    return invalid();
  }
  return Object.freeze({
    name: input.name.trim(),
    category: input.category.trim(),
  });
}

module.exports = { createBusGroupData, CATEGORIES };
