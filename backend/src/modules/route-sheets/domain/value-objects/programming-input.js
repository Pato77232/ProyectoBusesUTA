const { RouteProgrammingValidationError } = require('../errors/route-programming-errors');

function requireObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RouteProgrammingValidationError(`${field} debe ser un objeto.`);
  }
  return value;
}

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new RouteProgrammingValidationError(`${field} debe ser texto no vacío.`);
  }
  return value.trim();
}

function readList(value, field, reader) {
  if (!Array.isArray(value)) {
    throw new RouteProgrammingValidationError(`${field} debe ser una lista explícita.`);
  }
  return Array.from(value, reader);
}

function requireUnique(values, field) {
  if (new Set(values).size !== values.length) {
    throw new RouteProgrammingValidationError(`${field} contiene identidades repetidas.`);
  }
}

function assertContext(value, context) {
  requireObject(value, 'Snapshot');
  if (value.cooperativeId !== context.cooperativeId || value.busGroupId !== context.busGroupId) {
    throw new RouteProgrammingValidationError('El snapshot no pertenece a la cooperativa y grupo.');
  }
}

module.exports = { requireObject, requireText, readList, requireUnique, assertContext };
