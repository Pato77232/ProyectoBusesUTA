const RouteSheetDTO = require('../dtos/route-sheet.dto');
const { RouteSheetNotFoundError } = require('../../domain/errors/route-sheet-errors');

function publishRouteSheetUseCase({ routeSheetRepository }) {
  return async ({ routeSheetId, cooperativeId, publishedBy }) => {
    const routeSheet = await routeSheetRepository.findById(routeSheetId, cooperativeId);
    if (!routeSheet) {
      throw new RouteSheetNotFoundError();
    }
    routeSheet.publish(publishedBy);
    const saved = await routeSheetRepository.save(routeSheet);
    return RouteSheetDTO.fromEntity(saved, [], []);
  };
}

module.exports = publishRouteSheetUseCase;
