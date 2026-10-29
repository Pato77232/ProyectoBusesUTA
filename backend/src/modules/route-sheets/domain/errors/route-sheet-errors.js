const DomainError = require('./domain-error');

const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_CONFLICT = 409;
const HTTP_STATUS_FORBIDDEN = 403;

class RouteSheetAlreadyExistsForDateAndGroupError extends DomainError {
  constructor() {
    super('Ya existe una hoja de ruta para esa fecha y grupo de buses.', 'ROUTE_SHEET_ALREADY_EXISTS_FOR_DATE_AND_GROUP', HTTP_STATUS_CONFLICT);
    this.name = 'RouteSheetAlreadyExistsForDateAndGroupError';
  }
}

class RouteSheetNotFoundError extends DomainError {
  constructor() {
    super('Hoja de ruta no encontrada.', 'ROUTE_SHEET_NOT_FOUND', HTTP_STATUS_NOT_FOUND);
    this.name = 'RouteSheetNotFoundError';
  }
}

class RouteSheetNotEditableError extends DomainError {
  constructor() {
    super('La hoja de ruta no se puede editar en su estado actual.', 'ROUTE_SHEET_NOT_EDITABLE', HTTP_STATUS_FORBIDDEN);
    this.name = 'RouteSheetNotEditableError';
  }
}

class FrequencyNotActiveError extends DomainError {
  constructor() {
    super('La frecuencia no está activa.', 'FREQUENCY_NOT_ACTIVE', HTTP_STATUS_BAD_REQUEST);
    this.name = 'FrequencyNotActiveError';
  }
}

class FrequencyNotFromCooperativeError extends DomainError {
  constructor() {
    super('La frecuencia pertenece a otra cooperativa.', 'FREQUENCY_NOT_FROM_COOPERATIVE', HTTP_STATUS_FORBIDDEN);
    this.name = 'FrequencyNotFromCooperativeError';
  }
}

class BusNotFromCooperativeError extends DomainError {
  constructor() {
    super('El bus pertenece a otra cooperativa.', 'BUS_NOT_FROM_COOPERATIVE', HTTP_STATUS_FORBIDDEN);
    this.name = 'BusNotFromCooperativeError';
  }
}

class BusGroupNotFromCooperativeError extends DomainError {
  constructor() {
    super('El grupo de buses pertenece a otra cooperativa.', 'BUS_GROUP_NOT_FROM_COOPERATIVE', HTTP_STATUS_FORBIDDEN);
    this.name = 'BusGroupNotFromCooperativeError';
  }
}

class BusAlreadyAssignedError extends DomainError {
  constructor() {
    super('El bus ya está asignado en esta hoja de ruta.', 'BUS_ALREADY_ASSIGNED', HTTP_STATUS_CONFLICT);
    this.name = 'BusAlreadyAssignedError';
  }
}

class BusAssignmentConflictWithPassengersError extends DomainError {
  constructor() {
    super('El bus ya tiene pasajeros asignados. Se requiere confirmación con advertencia.', 'BUS_ASSIGNMENT_CONFLICT_WITH_PASSENGERS', HTTP_STATUS_CONFLICT);
    this.name = 'BusAssignmentConflictWithPassengersError';
  }
}

class TooManyBusesForFrequenciesError extends DomainError {
  constructor() {
    super('No se pueden asignar más buses que frecuencias activas disponibles.', 'TOO_MANY_BUSES_FOR_FREQUENCIES', HTTP_STATUS_BAD_REQUEST);
    this.name = 'TooManyBusesForFrequenciesError';
  }
}

class InvalidRestDayAssignmentError extends DomainError {
  constructor() {
    super('No se puede asignar el bus a día de parada en su estado actual.', 'INVALID_REST_DAY_ASSIGNMENT', HTTP_STATUS_BAD_REQUEST);
    this.name = 'InvalidRestDayAssignmentError';
  }
}

class MissingBusGroupForRouteSheetError extends DomainError {
  constructor() {
    super('Es obligatorio vincular la hoja de ruta a un grupo de buses.', 'MISSING_BUS_GROUP_FOR_ROUTE_SHEET', HTTP_STATUS_BAD_REQUEST);
    this.name = 'MissingBusGroupForRouteSheetError';
  }
}

class CycleGenerationNotAllowedError extends DomainError {
  constructor() {
    super('No se puede generar ciclos automáticos para esta hoja de ruta.', 'CYCLE_GENERATION_NOT_ALLOWED', HTTP_STATUS_BAD_REQUEST);
    this.name = 'CycleGenerationNotAllowedError';
  }
}

class MaxAutomaticCyclesExceededError extends DomainError {
  constructor() {
    super('Ya se generaron los 2 ciclos automáticos máximos para esta hoja base.', 'MAX_AUTOMATIC_CYCLES_EXCEEDED', HTTP_STATUS_BAD_REQUEST);
    this.name = 'MaxAutomaticCyclesExceededError';
  }
}

class RouteSheetCycleConflictError extends DomainError {
  constructor() {
    super('Existe conflicto de fechas entre ciclos generados.', 'ROUTE_SHEET_CYCLE_CONFLICT', HTTP_STATUS_CONFLICT);
    this.name = 'RouteSheetCycleConflictError';
  }
}

const HTTP_STATUS_NOT_FOUND = 404;

module.exports = {
  RouteSheetAlreadyExistsForDateAndGroupError,
  RouteSheetNotFoundError,
  RouteSheetNotEditableError,
  FrequencyNotActiveError,
  FrequencyNotFromCooperativeError,
  BusNotFromCooperativeError,
  BusGroupNotFromCooperativeError,
  BusAlreadyAssignedError,
  BusAssignmentConflictWithPassengersError,
  TooManyBusesForFrequenciesError,
  InvalidRestDayAssignmentError,
  MissingBusGroupForRouteSheetError,
  CycleGenerationNotAllowedError,
  MaxAutomaticCyclesExceededError,
  RouteSheetCycleConflictError,
};
