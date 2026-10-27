const RouteSheetDTO = require('../dtos/route-sheet.dto');

function listRouteSheetsUseCase({ routeSheetRepository }) {
  return async ({ cooperativeId, busGroupId, fromDate, toDate, status }) => {
    const routeSheets = await routeSheetRepository.findAll(cooperativeId, { busGroupId, fromDate, toDate, status });
    return routeSheets.map((routeSheet) => RouteSheetDTO.fromEntity(routeSheet, [], []));
  };
}

module.exports = listRouteSheetsUseCase;
