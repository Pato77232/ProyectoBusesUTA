const {
  parseTariffRequest,
  createDraftTariff,
  assertUuid,
} = require('../../domain/value-objects/draft-tariff');
const { TariffConflictError } = require('../../domain/errors/route-tariff-errors');
const routePoints = require('../../domain/value-objects/tariff-route-points');

function assertDraftRevision(sheet, expectedRevision) {
  if (sheet.status !== 'DRAFT')
    throw new TariffConflictError(
      'ROUTE_TARIFF_NOT_EDITABLE',
      'Solo se configura el tarifario de una hoja en borrador.',
    );
  if (sheet.tariff_revision !== expectedRevision)
    throw new TariffConflictError(
      'ROUTE_TARIFF_REVISION_CONFLICT',
      'El tarifario cambió; consulta su revisión vigente antes de reemplazarlo.',
    );
}

function configureRouteSheetTariff({ tariffRepository, frequencyQueryPort }) {
  return async ({ routeSheetId, cooperativeId, modifiedBy, body }) => {
    const context = {
      routeSheetId: assertUuid(routeSheetId),
      cooperativeId: assertUuid(cooperativeId),
      modifiedBy: assertUuid(modifiedBy),
    };
    const request = parseTariffRequest(body);
    return tariffRepository.withLockedSheet(context, async ({ sheet, frequencyIds, save }) => {
      assertDraftRevision(sheet, request.expectedRevision);
      const assigned = new Set(frequencyIds);
      if (
        assigned.size !== request.frequencies.length ||
        request.frequencies.some(({ frequencyId }) => !assigned.has(frequencyId))
      ) {
        throw new TariffConflictError(
          'ROUTE_TARIFF_FREQUENCY_MISMATCH',
          'Configura todas y solo las frecuencias asignadas a esta hoja.',
        );
      }
      const routes = new Map();
      for (const { frequencyId } of request.frequencies) {
        const detail = await frequencyQueryPort.findWithStops(frequencyId, context.cooperativeId);
        routes.set(frequencyId, routePoints(detail, frequencyId, context.cooperativeId));
      }
      const tariff = createDraftTariff(request, routes);
      return save(tariff);
    });
  };
}

module.exports = configureRouteSheetTariff;
