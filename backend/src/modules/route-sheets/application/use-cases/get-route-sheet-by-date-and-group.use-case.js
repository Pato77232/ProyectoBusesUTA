const RouteSheetDTO = require('../dtos/route-sheet.dto');
const { RouteSheetNotFoundError } = require('../../domain/errors/route-sheet-errors');

function getRouteSheetByDateAndGroupUseCase({ routeSheetRepository, routeSheetAssignmentRepository, routeSheetRestDayRepository }) {
  return async ({ cooperativeId, busGroupId, routeDate }) => {
    const routeSheet = await routeSheetRepository.findByDateAndGroup(cooperativeId, busGroupId, routeDate);
    if (!routeSheet) {
      return null;
    }
    const assignments = await routeSheetAssignmentRepository.findByRouteSheetId(routeSheet.id, cooperativeId);
    const restDays = await routeSheetRestDayRepository.findByRouteSheetId(routeSheet.id, cooperativeId);
    return RouteSheetDTO.fromEntity(routeSheet, assignments, restDays);
  };
}

module.exports = getRouteSheetByDateAndGroupUseCase;
