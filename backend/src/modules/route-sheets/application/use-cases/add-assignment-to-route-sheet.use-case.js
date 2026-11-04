const RouteSheetAssignment = require('../../domain/entities/route-sheet-assignment');
const RouteSheetDTO = require('../dtos/route-sheet.dto');
const RouteSheetValidationService = require('../services/route-sheet-validation.service');
const recordRouteSheetModification = require('../services/record-route-sheet-modification');
const {
  RouteSheetNotFoundError,
  FrequencyNotFromCooperativeError,
  BusNotFromCooperativeError,
  BusNotInRouteSheetGroupError,
} = require('../../domain/errors/route-sheet-errors');

function addAssignmentToRouteSheetUseCase({
  routeSheetRepository,
  routeSheetAssignmentRepository,
  routeSheetModificationLogRepository,
  frequencyQueryPort,
  busQueryPort,
  bookingQueryPort,
}) {
  const validationService = new RouteSheetValidationService();

  return async ({
    routeSheetId,
    cooperativeId,
    busId,
    frequencyId,
    modifiedBy,
    reason,
    forceWithPassengersWarning,
  }) => {
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
    if (bus.busGroupId !== routeSheet.busGroupId) {
      throw new BusNotInRouteSheetGroupError();
    }

    const assignments = await routeSheetAssignmentRepository.findByRouteSheetId(
      routeSheetId,
      cooperativeId,
    );
    validationService.validateBusNotAssigned(assignments, busId);

    const activeFrequencies = await frequencyQueryPort.findActiveByCooperativeId(cooperativeId);
    validationService.validateMaxBusesForFrequencies(assignments.length, activeFrequencies.length);

    if (bookingQueryPort && !routeSheet.isEditable()) {
      const hasPassengers = await bookingQueryPort.hasPassengersForBusOnRouteSheet(
        routeSheetId,
        busId,
        cooperativeId,
      );
      validationService.validatePassengersConflict(
        hasPassengers,
        forceWithPassengersWarning,
        reason,
      );
    }

    const assignment = new RouteSheetAssignment({
      routeSheetId,
      cooperativeId,
      busGroupId: routeSheet.busGroupId,
      busId,
      frequencyId,
    });

    const savedAssignment = (await routeSheetAssignmentRepository.save)
      ? await routeSheetAssignmentRepository.save(assignment)
      : assignment;
    await recordRouteSheetModification({
      repository: routeSheetModificationLogRepository,
      routeSheetId,
      cooperativeId,
      busGroupId: routeSheet.busGroupId,
      modifiedBy,
      reason,
      action: 'CREATE',
      affectedEntity: 'ASSIGNMENT',
      entityId: savedAssignment.id,
      newValue: { busId, frequencyId },
    });
    const updatedAssignments = [...assignments, savedAssignment];
    const restDays = [];

    return RouteSheetDTO.fromEntity(routeSheet, updatedAssignments, restDays);
  };
}

module.exports = addAssignmentToRouteSheetUseCase;
