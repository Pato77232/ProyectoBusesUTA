class BusRegistrationValidationError extends Error {
  constructor() {
    super('Datos de registro de bus inválidos.');
    this.name = 'BusRegistrationValidationError';
    this.code = 'VALIDATION_ERROR';
  }
}

class BusSeatLayoutNotFoundError extends Error {
  constructor() {
    super('La plantilla o su versión no está disponible.');
    this.name = 'BusSeatLayoutNotFoundError';
    this.code = 'SEAT_LAYOUT_NOT_FOUND';
  }
}

class BusGroupNotFoundError extends Error {
  constructor() {
    super('El grupo de buses no está disponible.');
    this.name = 'BusGroupNotFoundError';
    this.code = 'BUS_GROUP_NOT_FOUND';
  }
}

class BusAlreadyExistsError extends Error {
  constructor() {
    super('El bus entra en conflicto con un registro existente.');
    this.name = 'BusAlreadyExistsError';
    this.code = 'BUS_ALREADY_EXISTS';
  }
}

class BusRegistrationCommitUnknownError extends Error {
  constructor({ busId, cooperativeId, cause }) {
    super('No se pudo confirmar el resultado del registro.', { cause });
    this.name = 'BusRegistrationCommitUnknownError';
    this.code = 'BUS_REGISTRATION_COMMIT_UNKNOWN';
    // Contexto interno de recuperación, nunca para serializar directamente al cliente.
    this.busId = busId;
    this.cooperativeId = cooperativeId;
  }
}

module.exports = {
  BusRegistrationValidationError,
  BusSeatLayoutNotFoundError,
  BusGroupNotFoundError,
  BusAlreadyExistsError,
  BusRegistrationCommitUnknownError,
};
