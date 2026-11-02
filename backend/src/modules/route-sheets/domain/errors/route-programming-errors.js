const DomainError = require('./domain-error');

class RouteProgrammingValidationError extends DomainError {
  constructor(message) {
    super(message, 'ROUTE_PROGRAMMING_INVALID', 400);
    this.name = 'RouteProgrammingValidationError';
  }
}

class RouteProgrammingConflictError extends DomainError {
  constructor(code, message) {
    super(message, code, 409);
    this.name = 'RouteProgrammingConflictError';
  }
}

module.exports = { RouteProgrammingValidationError, RouteProgrammingConflictError };
