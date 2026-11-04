const RouteSheetRestDay = require('../../domain/entities/route-sheet-rest-day');
const RouteSheetDTO = require('../dtos/route-sheet.dto');
const RouteSheetValidationService = require('../services/route-sheet-validation.service');
const recordRouteSheetModification = require('../services/record-route-sheet-modification');
const {
  RouteSheetNotFoundError,
  BusNotFromCooperativeError,
  BusNotInRouteSheetGroupError,
} = require('../../domain/errors/route-sheet-errors');

function addRestDayToRouteSheetUseCase({
  routeSheetRepository,
  routeSheetRestDayRepository,
  routeSheetAssignmentRepository,
  routeSheetModificationLogRepository,
  busQueryPort,
  bookingQueryPort,
}) {
  const validationService = new RouteSheetValidationService();

  return async ({
    routeSheetId,
    cooperativeId,
    busId,
    reason,
    modifiedBy,
    reasonForChange,
    forceWithPassengersWarning,
  }) => {
    const routeSheet = await routeSheetRepository.findById(routeSheetId, cooperativeId);
    if (!routeSheet) {
      throw new RouteSheetNotFoundError();
    }
    routeSheet.assertEditable();

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

    const restDays = await routeSheetRestDayRepository.findByRouteSheetId(
      routeSheetId,
      cooperativeId,
    );
    validationService.validateBusNotInRestDay(restDays, busId);

    const changeReason = reasonForChange || reason;
    if (bookingQueryPort && !routeSheet.isEditable()) {
      const hasPassengers = await bookingQueryPort.hasPassengersForBusOnRouteSheet(
        routeSheetId,
        busId,
        cooperativeId,
      );
      validationService.validatePassengersConflict(
        hasPassengers,
        forceWithPassengersWarning,
        changeReason,
      );
    }

    const restDay = new RouteSheetRestDay({
      routeSheetId,
      cooperativeId,
      busGroupId: routeSheet.busGroupId,
      busId,
      reason,
    });

    const savedRestDay = routeSheetRestDayRepository.save
      ? await routeSheetRestDayRepository.save(restDay)
      : restDay;
    await recordRouteSheetModification({
      repository: routeSheetModificationLogRepository,
      routeSheetId,
      cooperativeId,
      busGroupId: routeSheet.busGroupId,
      modifiedBy,
      reason: changeReason,
      action: 'CREATE',
      affectedEntity: 'REST_DAY',
      entityId: savedRestDay.id,
      newValue: { busId },
    });
    const updatedRestDays = [...restDays, savedRestDay];
    return RouteSheetDTO.fromEntity(routeSheet, assignments, updatedRestDays);
  };
}

module.exports = addRestDayToRouteSheetUseCase;
