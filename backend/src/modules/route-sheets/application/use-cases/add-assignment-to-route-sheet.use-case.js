const RouteSheetAssignment = require('../../domain/entities/route-sheet-assignment');
const RouteSheetDTO = require('../dtos/route-sheet.dto');
const RouteSheetValidationService = require('../services/route-sheet-validation.service');
const {
  RouteSheetNotFoundError,
  FrequencyNotFromCooperativeError,
  BusNotFromCooperativeError,
} = require('../../domain/errors/route-sheet-errors');

function addAssignmentToRouteSheetUseCase({
  routeSheetRepository,
  routeSheetAssignmentRepository,
  frequencyQueryPort,
  busQueryPort,
  bookingQueryPort,
}) {
  const validationService = new RouteSheetValidationService();

  return async ({ routeSheetId, cooperativeId, busId, frequencyId, modifiedBy, reason, forceWithPassengersWarning }) => {
    const routeSheet = await routeSheetRepository.findById(routeSheetId, cooperativeId);
    if (!routeSheet) {
      throw new RouteSheetNotFoundError();
    }
    routeSheet.assertEditable();

    const frequency = await frequencyQueryPort.findById(frequencyId, cooperativeId);
    if (!frequency) {
      throw new FrequencyNotFromCooperativeError();
    }
    validationService.validateFrequencyActive(frequency);

    const bus = await busQueryPort.findById(busId, cooperativeId);
    if (!bus) {
      throw new BusNotFromCooperativeError();
    }
    if (bus.bus_group_id && bus.bus_group_id !== routeSheet.busGroupId) {
      throw new BusNotFromCooperativeError();
    }

    const assignments = await routeSheetAssignmentRepository.findByRouteSheetId(routeSheetId, cooperativeId);
    validationService.validateBusNotAssigned(assignments, busId);

    const activeFrequencies = await frequencyQueryPort.findActiveByCooperativeId(cooperativeId);
    validationService.validateMaxBusesForFrequencies(assignments.length, activeFrequencies.length);

    if (bookingQueryPort && !routeSheet.isEditable()) {
      const hasPassengers = await bookingQueryPort.hasPassengersForBusOnRouteSheet(routeSheetId, busId, cooperativeId);
      validationService.validatePassengersConflict(hasPassengers, forceWithPassengersWarning, reason);
    }

    const assignment = new RouteSheetAssignment({
      routeSheetId,
      cooperativeId,
      busGroupId: routeSheet.busGroupId,
      busId,
      frequencyId,
    });

    const savedAssignment = await routeSheetAssignmentRepository.save ? await routeSheetAssignmentRepository.save(assignment) : assignment;
    const updatedAssignments = [...assignments, savedAssignment];
    const restDays = [];

    return RouteSheetDTO.fromEntity(routeSheet, updatedAssignments, restDays);
  };
}

module.exports = addAssignmentToRouteSheetUseCase;
