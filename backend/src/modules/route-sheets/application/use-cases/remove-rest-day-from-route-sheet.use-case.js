const RouteSheetDTO = require('../dtos/route-sheet.dto');
const RouteSheetValidationService = require('../services/route-sheet-validation.service');
const { RouteSheetNotFoundError } = require('../../domain/errors/route-sheet-errors');

function removeRestDayFromRouteSheetUseCase({ routeSheetRepository, routeSheetRestDayRepository, routeSheetAssignmentRepository, bookingQueryPort }) {
  const validationService = new RouteSheetValidationService();

  return async ({ routeSheetId, cooperativeId, restDayId, modifiedBy, reasonForChange, forceWithPassengersWarning }) => {
    const routeSheet = await routeSheetRepository.findById(routeSheetId, cooperativeId);
    if (!routeSheet) {
      throw new RouteSheetNotFoundError();
    }
    routeSheet.assertEditable();

    const restDays = await routeSheetRestDayRepository.findByRouteSheetId(routeSheetId, cooperativeId);
    const restDay = restDays.find((r) => r.id === restDayId);

    if (bookingQueryPort && restDay) {
      const hasPassengers = await bookingQueryPort.hasPassengersForBusOnRouteSheet(routeSheetId, restDay.busId, cooperativeId);
      validationService.validatePassengersConflict(hasPassengers, forceWithPassengersWarning, reasonForChange);
    }

    if (routeSheetRestDayRepository.removeById) {
      await routeSheetRestDayRepository.removeById(restDayId, cooperativeId);
    } else if (routeSheetRestDayRepository.deleteById) {
      await routeSheetRestDayRepository.deleteById(restDayId, cooperativeId);
    }

    const assignments = await routeSheetAssignmentRepository.findByRouteSheetId(routeSheetId, cooperativeId);
    const updatedRestDays = restDays.filter((r) => r.id !== restDayId);
    return RouteSheetDTO.fromEntity(routeSheet, assignments, updatedRestDays);
  };
}

module.exports = removeRestDayFromRouteSheetUseCase;
