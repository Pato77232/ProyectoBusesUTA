// SEARCH-02: parámetros opcionales de las próximas salidas; nada más se acepta.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^(?!0000)\d{4}-\d{2}-\d{2}$/;

class UpcomingValidationError extends Error {
  constructor() {
    super('La fecha o la cooperativa indicadas no son válidas.');
    this.name = 'UpcomingValidationError';
    this.code = 'SEARCH_INVALID';
  }
}

function realDate(value) {
  return (
    typeof value === 'string' &&
    DATE.test(value) &&
    Number.isFinite(Date.parse(value + 'T00:00:00Z')) &&
    new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value
  );
}

module.exports = (input = {}) => {
  if (
    !input ||
    typeof input !== 'object' ||
    Object.keys(input).some((key) => !['date', 'cooperativeId'].includes(key))
  )
    throw new UpcomingValidationError();
  const { date, cooperativeId } = input;
  if (date !== undefined && !realDate(date)) throw new UpcomingValidationError();
  if (
    cooperativeId !== undefined &&
    (typeof cooperativeId !== 'string' || !UUID.test(cooperativeId))
  )
    throw new UpcomingValidationError();
  return Object.freeze({
    date: date ?? null,
    cooperativeId: cooperativeId ? cooperativeId.toLowerCase() : null,
  });
};
