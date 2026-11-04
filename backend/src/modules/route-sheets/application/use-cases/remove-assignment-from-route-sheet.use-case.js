const RouteSheetDTO = require('../dtos/route-sheet.dto');
const RouteSheetValidationService = require('../services/route-sheet-validation.service');
const recordRouteSheetModification = require('../services/record-route-sheet-modification');
const { RouteSheetNotFoundError } = require('../../domain/errors/route-sheet-errors');

function removeAssignmentFromRouteSheetUseCase({
  routeSheetRepository,
  routeSheetAssignmentRepository,
  routeSheetModificationLogRepository,
  bookingQueryPort,
}) {
  const validationService = new RouteSheetValidationService();

  return async ({
    routeSheetId,
    cooperativeId,
    assignmentId,
    modifiedBy,
    reason,
    forceWithPassengersWarning,
  }) => {
    const routeSheet = await routeSheetRepository.findById(routeSheetId, cooperativeId);
    if (!routeSheet) {
      throw new RouteSheetNotFoundError();
    }
    routeSheet.assertEditable();

    const assignments = await routeSheetAssignmentRepository.findByRouteSheetId(
      routeSheetId,
      cooperativeId,
    );
    const assignment = assignments.find((a) => a.id === assignmentId);

    let hasPassengers = false;
    if (bookingQueryPort && assignment) {
      hasPassengers = await bookingQueryPort.hasPassengersForAssignment(
        assignmentId,
        cooperativeId,
      );
      validationService.validatePassengersConflict(
        hasPassengers,
        forceWithPassengersWarning,
        reason,
      );
    }

    if (routeSheetAssignmentRepository.removeById) {
      await routeSheetAssignmentRepository.removeById(assignmentId, cooperativeId);
    } else if (routeSheetAssignmentRepository.deleteById) {
      await routeSheetAssignmentRepository.deleteById(assignmentId, cooperativeId);
    }

    if (assignment) {
      await recordRouteSheetModification({
        repository: routeSheetModificationLogRepository,
        routeSheetId,
        cooperativeId,
        busGroupId: routeSheet.busGroupId,
        modifiedBy,
        reason,
        action: 'DELETE',
        affectedEntity: 'ASSIGNMENT',
        entityId: assignment.id,
        oldValue: { busId: assignment.busId, frequencyId: assignment.frequencyId },
        hasPassengersWarning: hasPassengers,
      });
    }

    const updatedAssignments = assignments.filter((a) => a.id !== assignmentId);
    return RouteSheetDTO.fromEntity(routeSheet, updatedAssignments, []);
  };
}

module.exports = removeAssignmentFromRouteSheetUseCase;
