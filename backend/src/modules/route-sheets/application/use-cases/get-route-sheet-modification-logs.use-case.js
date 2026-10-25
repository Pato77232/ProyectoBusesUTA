const RouteSheetModificationLogDTO = require('../dtos/route-sheet-modification-log.dto');
const { RouteSheetNotFoundError } = require('../../domain/errors/route-sheet-errors');

function getRouteSheetModificationLogsUseCase({ routeSheetRepository, routeSheetModificationLogRepository }) {
  return async ({ routeSheetId, cooperativeId }) => {
    const routeSheet = await routeSheetRepository.findById(routeSheetId, cooperativeId);
    if (!routeSheet) {
      throw new RouteSheetNotFoundError();
    }
    const logs = await routeSheetModificationLogRepository.findByRouteSheetId(routeSheetId, cooperativeId);
    return logs.map((log) => RouteSheetModificationLogDTO.fromEntity(log));
  };
}

module.exports = getRouteSheetModificationLogsUseCase;
