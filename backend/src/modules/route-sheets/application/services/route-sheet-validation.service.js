const {
  FrequencyNotActiveError,
  BusAlreadyAssignedError,
  TooManyBusesForFrequenciesError,
  InvalidRestDayAssignmentError,
  BusAssignmentConflictWithPassengersError,
} = require('../../domain/errors/route-sheet-errors');

class RouteSheetValidationService {
  validateFrequencyActive(frequency) {
    if (!frequency) {
      throw new Error('Frecuencia no encontrada.');
    }
    if (frequency.status && frequency.status !== 'ACTIVE') {
      throw new FrequencyNotActiveError();
    }
  }

  validateBusNotAssigned(assignments, busId) {
    const alreadyAssigned = assignments.some((assignment) => assignment.busId === busId);
    if (alreadyAssigned) {
      throw new BusAlreadyAssignedError();
    }
  }

  validateBusNotInRestDay(restDays, busId) {
    const inRestDay = restDays.some((restDay) => restDay.busId === busId);
    if (inRestDay) {
      throw new InvalidRestDayAssignmentError();
    }
  }

  validateMaxBusesForFrequencies(assignmentsCount, activeFrequenciesCount) {
    if (assignmentsCount >= activeFrequenciesCount) {
      throw new TooManyBusesForFrequenciesError();
    }
  }

  validatePassengersConflict(hasPassengers, forceWithPassengersWarning, reason) {
    if (hasPassengers && !forceWithPassengersWarning) {
      throw new BusAssignmentConflictWithPassengersError();
    }
    if (hasPassengers && forceWithPassengersWarning && (!reason || reason.trim() === '')) {
      throw new Error('Se requiere una razón para modificar con pasajeros presentes.');
    }
  }
}

module.exports = RouteSheetValidationService;
