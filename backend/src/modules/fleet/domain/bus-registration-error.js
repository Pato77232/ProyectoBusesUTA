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

module.exports = {
  BusRegistrationValidationError,
  BusSeatLayoutNotFoundError,
  BusGroupNotFoundError,
};
