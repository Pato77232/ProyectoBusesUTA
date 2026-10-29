const RouteSheetDTO = require('../dtos/route-sheet.dto');
const RouteSheetValidationService = require('../services/route-sheet-validation.service');
const { RouteSheetNotFoundError } = require('../../domain/errors/route-sheet-errors');

function removeAssignmentFromRouteSheetUseCase({ routeSheetRepository, routeSheetAssignmentRepository, bookingQueryPort }) {
  const validationService = new RouteSheetValidationService();

  return async ({ routeSheetId, cooperativeId, assignmentId, modifiedBy, reason, forceWithPassengersWarning }) => {
    const routeSheet = await routeSheetRepository.findById(routeSheetId, cooperativeId);
    if (!routeSheet) {
      throw new RouteSheetNotFoundError();
    }
    routeSheet.assertEditable();

    const assignments = await routeSheetAssignmentRepository.findByRouteSheetId(routeSheetId, cooperativeId);
    const assignment = assignments.find((a) => a.id === assignmentId);

    if (bookingQueryPort && assignment) {
      const hasPassengers = await bookingQueryPort.hasPassengersForAssignment(assignmentId, cooperativeId);
      validationService.validatePassengersConflict(hasPassengers, forceWithPassengersWarning, reason);
    }

    if (routeSheetAssignmentRepository.removeById) {
      await routeSheetAssignmentRepository.removeById(assignmentId, cooperativeId);
    } else if (routeSheetAssignmentRepository.deleteById) {
      await routeSheetAssignmentRepository.deleteById(assignmentId, cooperativeId);
    }

    const updatedAssignments = assignments.filter((a) => a.id !== assignmentId);
    return RouteSheetDTO.fromEntity(routeSheet, updatedAssignments, []);
  };
}

module.exports = removeAssignmentFromRouteSheetUseCase;
