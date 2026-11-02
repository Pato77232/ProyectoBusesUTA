// Acepta cualquier UUID que PostgreSQL pueda haber guardado; la versión no importa en una lectura.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QUERY_FIELDS = ['busId', 'cooperativeId'];

class InvalidBusSeatQueryError extends Error {
  constructor() {
    super('Consulta de asientos inválida.');
    this.name = 'InvalidBusSeatQueryError';
    this.code = 'VALIDATION_ERROR';
  }
}

function createBusSeatQuery(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new InvalidBusSeatQueryError();
  }
  const keys = Object.keys(input);
  const validFields =
    keys.length === QUERY_FIELDS.length && QUERY_FIELDS.every((field) => keys.includes(field));
  const validValues = QUERY_FIELDS.every(
    (field) => typeof input[field] === 'string' && UUID_PATTERN.test(input[field]),
  );
  if (!validFields || !validValues) throw new InvalidBusSeatQueryError();
  return { busId: input.busId, cooperativeId: input.cooperativeId };
}

module.exports = { createBusSeatQuery, InvalidBusSeatQueryError };
