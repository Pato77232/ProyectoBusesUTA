const DomainError = require('./domain-error');

class TariffValidationError extends DomainError {
  constructor(message = 'El tarifario contiene datos inválidos.') {
    super(message, 'ROUTE_TARIFF_INVALID', 400);
    this.name = 'TariffValidationError';
  }
}

class TariffConflictError extends DomainError {
  constructor(code, message) {
    super(message, code, 409);
    this.name = 'TariffConflictError';
  }
}

class TariffNotFoundError extends DomainError {
  constructor() {
    super('Hoja de ruta no encontrada.', 'ROUTE_SHEET_NOT_FOUND', 404);
    this.name = 'TariffNotFoundError';
  }
}

class TariffSourceError extends DomainError {
  constructor() {
    super(
      'No está disponible el recorrido autorizado para configurar tarifas.',
      'ROUTE_TARIFF_SOURCE_UNAVAILABLE',
      503,
    );
    this.name = 'TariffSourceError';
  }
}

module.exports = {
  TariffValidationError,
  TariffConflictError,
  TariffNotFoundError,
  TariffSourceError,
};
