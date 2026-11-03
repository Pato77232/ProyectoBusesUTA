const DomainError = require('./domain-error');

class ProgrammingNotFoundError extends DomainError {
  constructor() {
    super('Hoja de ruta no encontrada.', 'ROUTE_SHEET_NOT_FOUND', 404);
  }
}

class ProgrammingSourceError extends DomainError {
  constructor() {
    super('No está disponible la agenda autorizada.', 'ROUTE_PROGRAMMING_SOURCE_UNAVAILABLE', 503);
  }
}

module.exports = { ProgrammingNotFoundError, ProgrammingSourceError };
