const DomainError = require('./domain-error');

class RenewalValidationError extends DomainError {
  constructor(message = 'La solicitud de renovación contiene datos inválidos.') {
    super(message, 'ROUTE_RENEWAL_INVALID', 400);
    this.name = 'RenewalValidationError';
  }
}

class RenewalConflictError extends DomainError {
  constructor(code, message) {
    super(message, code, 409);
    this.name = 'RenewalConflictError';
  }
}

class RenewalSourceError extends DomainError {
  constructor() {
    super('La fuente de renovación no es verificable.', 'ROUTE_RENEWAL_SOURCE_UNAVAILABLE', 503);
    this.name = 'RenewalSourceError';
  }
}

class RenewalNotFoundError extends DomainError {
  constructor() {
    super('Hoja de origen no encontrada.', 'ROUTE_RENEWAL_NOT_FOUND', 404);
    this.name = 'RenewalNotFoundError';
  }
}

module.exports = {
  RenewalValidationError,
  RenewalConflictError,
  RenewalSourceError,
  RenewalNotFoundError,
};
