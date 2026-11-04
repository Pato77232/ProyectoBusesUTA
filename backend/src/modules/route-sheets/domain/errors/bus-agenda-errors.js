const DomainError = require('./domain-error');

class BusAgendaValidationError extends DomainError {
  constructor(message) {
    super(message, 'BUS_AGENDA_INVALID', 400);
    this.name = 'BusAgendaValidationError';
  }
}

class BusAgendaConflictError extends DomainError {
  constructor(code, message, activityId, relatedId = null) {
    super(message, code, 409);
    this.name = 'BusAgendaConflictError';
    this.activityId = activityId;
    this.relatedId = relatedId;
  }
}

module.exports = { BusAgendaValidationError, BusAgendaConflictError };
