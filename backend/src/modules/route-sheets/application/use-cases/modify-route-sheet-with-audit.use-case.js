const RouteSheetModificationLog = require('../../domain/entities/route-sheet-modification-log');
const RouteSheetDTO = require('../dtos/route-sheet.dto');
const RouteSheetValidationService = require('../services/route-sheet-validation.service');
const { RouteSheetNotFoundError } = require('../../domain/errors/route-sheet-errors');

function modifyRouteSheetWithAuditUseCase({
  routeSheetRepository,
  routeSheetAssignmentRepository,
  routeSheetRestDayRepository,
  routeSheetModificationLogRepository,
  bookingQueryPort,
}) {
  const validationService = new RouteSheetValidationService();

  return async ({ routeSheetId, cooperativeId, modifiedBy, reason, changes = [], forceWithPassengersWarning = false }) => {
    if (!reason || reason.trim() === '') {
      throw new Error('La razón de la modificación es obligatoria.');
    }
    if (!modifiedBy) {
      throw new Error('El usuario que modifica es obligatorio.');
    }

    const routeSheet = await routeSheetRepository.findById(routeSheetId, cooperativeId);
    if (!routeSheet) {
      throw new RouteSheetNotFoundError();
    }

    const assignments = await routeSheetAssignmentRepository.findByRouteSheetId(routeSheetId, cooperativeId);
    const restDays = await routeSheetRestDayRepository.findByRouteSheetId(routeSheetId, cooperativeId);

    const logs = [];
    for (const change of changes) {
      if (change.entityType === 'ASSIGNMENT' && bookingQueryPort) {
        const hasPassengers = await bookingQueryPort.hasPassengersForAssignment(change.entityId, cooperativeId);
        validationService.validatePassengersConflict(hasPassengers, forceWithPassengersWarning, reason);
      }
      if (change.entityType === 'REST_DAY' && bookingQueryPort) {
        const restDay = restDays.find((r) => r.id === change.entityId);
        if (restDay) {
          const hasPassengers = await bookingQueryPort.hasPassengersForBusOnRouteSheet(routeSheetId, restDay.busId, cooperativeId);
          validationService.validatePassengersConflict(hasPassengers, forceWithPassengersWarning, reason);
        }
      }

      const log = new RouteSheetModificationLog({
        routeSheetId,
        routeSheetCycleId: change.routeSheetCycleId || null,
        cooperativeId,
        busGroupId: routeSheet.busGroupId,
        modifiedBy,
        reason: reason.trim(),
        action: change.action || 'UPDATE',
        affectedEntity: change.entityType,
        entityId: change.entityId,
        oldValue: change.oldValue || null,
        newValue: change.newValue || null,
        hasPassengersWarning: Boolean(forceWithPassengersWarning),
        passengersNotifiedContext: change.passengersNotifiedContext || null,
      });

      const savedLog = routeSheetModificationLogRepository.save ? await routeSheetModificationLogRepository.save(log) : log;
      logs.push(savedLog);
    }

    return {
      routeSheet: RouteSheetDTO.fromEntity(routeSheet, assignments, restDays),
      logs,
    };
  };
}

module.exports = modifyRouteSheetWithAuditUseCase;
