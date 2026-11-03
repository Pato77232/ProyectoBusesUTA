const DomainError = require('./domain-error');

class CommercialTripValidationError extends DomainError {
  constructor(message) {
    super(message, 'COMMERCIAL_TRIP_INVALID', 400);
  }
}
class CommercialTripConflictError extends DomainError {
  constructor(code, message) {
    super(message, code, 409);
  }
}
class CommercialTripSourceError extends DomainError {
  constructor() {
    super(
      'No está disponible la información comercial verificable.',
      'COMMERCIAL_TRIP_SOURCE_UNAVAILABLE',
      503,
    );
  }
}
module.exports = {
  CommercialTripValidationError,
  CommercialTripConflictError,
  CommercialTripSourceError,
};
