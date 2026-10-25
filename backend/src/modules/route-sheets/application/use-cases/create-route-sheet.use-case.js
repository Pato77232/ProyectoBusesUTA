const RouteSheet = require('../../domain/entities/route-sheet');
const RouteSheetDTO = require('../dtos/route-sheet.dto');
const { RouteSheetAlreadyExistsForDateAndGroupError, BusGroupNotFromCooperativeError, MissingBusGroupForRouteSheetError } = require('../../domain/errors/route-sheet-errors');

function createRouteSheetUseCase({ routeSheetRepository, busGroupQueryPort }) {
  return async ({ cooperativeId, routeDate, busGroupId, createdBy, notes }) => {
    if (!busGroupId) {
      throw new MissingBusGroupForRouteSheetError();
    }
    if (!cooperativeId) {
      throw new Error('El ID de la cooperativa es obligatorio.');
    }

    const busGroup = await busGroupQueryPort.findById(busGroupId, cooperativeId);
    if (!busGroup) {
      throw new BusGroupNotFromCooperativeError();
    }

    const exists = await routeSheetRepository.existsByDateAndGroup(cooperativeId, busGroupId, routeDate);
    if (exists) {
      throw new RouteSheetAlreadyExistsForDateAndGroupError();
    }

    const routeSheet = new RouteSheet({
      cooperativeId,
      busGroupId,
      routeDate,
      createdBy,
      notes,
    });

    const saved = await routeSheetRepository.save(routeSheet);
    return RouteSheetDTO.fromEntity(saved, [], []);
  };
}

module.exports = createRouteSheetUseCase;
