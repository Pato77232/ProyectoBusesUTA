const {
  parseTariffRequest,
  createDraftTariff,
  assertUuid,
} = require('../../domain/value-objects/draft-tariff');
const {
  TariffConflictError,
  TariffSourceError,
} = require('../../domain/errors/route-tariff-errors');

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

function routePoints(detail, frequencyId, cooperativeId) {
  if (!detail)
    throw new TariffConflictError(
      'ROUTE_TARIFF_FREQUENCY_MISMATCH',
      'La frecuencia no está disponible en la cooperativa.',
    );
  if (
    detail.id !== frequencyId ||
    detail.cooperativeId !== cooperativeId ||
    !Array.isArray(detail.stops)
  )
    throw new TariffSourceError();
  if (detail.status !== 'ACTIVE')
    throw new TariffConflictError(
      'ROUTE_TARIFF_FREQUENCY_INACTIVE',
      'La frecuencia debe estar activa.',
    );
  const points = [detail.origin, ...detail.stops, detail.destination];
  if (points.some((point) => typeof point !== 'string' || !point.trim()))
    throw new TariffSourceError();
  const normalized = points.map((point) => point.trim().normalize('NFC'));
  if (new Set(normalized.map((point) => point.toLowerCase())).size !== normalized.length)
    throw new TariffSourceError();
  return normalized;
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
