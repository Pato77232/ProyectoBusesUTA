const RouteSheetDTO = require('../dtos/route-sheet.dto');
const { assertUuid } = require('../../domain/value-objects/draft-tariff');
const restoreTariffSnapshot = require('../../domain/value-objects/restore-tariff-snapshot');
const {
  TariffValidationError,
  TariffConflictError,
  TariffSourceError,
} = require('../../domain/errors/route-tariff-errors');
const validateTariffForPublication = require('../services/validate-tariff-for-publication');
const {
  validateProgrammingForPublication,
  assertProgrammingRevision,
} = require('../services/validate-programming-for-publication');
const prepareCommercialPublication = require('../services/prepare-commercial-publication');
const { tripUuid } = require('../../domain/value-objects/commercial-inventory');
const {
  CommercialTripSourceError,
  CommercialTripConflictError,
} = require('../../domain/errors/commercial-trip-errors');

function assertRevision(value, current) {
  if (value === undefined) return;
  if (!Number.isSafeInteger(value) || value < 1)
    throw new TariffValidationError('expectedRevision debe ser un entero positivo.');
  if (value !== current)
    throw new TariffConflictError(
      'ROUTE_TARIFF_REVISION_CONFLICT',
      'El tarifario cambió antes de publicar.',
    );
}

function publishRouteSheetUseCase({
  tariffRepository,
  busQueryPort,
  seatQueryPort,
  now = () => new Date().toISOString(),
}) {
  return async ({
    routeSheetId,
    cooperativeId,
    publishedBy,
    expectedRevision,
    expectedProgrammingRevision,
    seriesId,
  }) => {
    if (!tariffRepository) throw new TariffSourceError();
    const context = {
      routeSheetId: assertUuid(routeSheetId),
      cooperativeId: assertUuid(cooperativeId),
      modifiedBy: assertUuid(publishedBy),
    };
    const requestedSeriesId = seriesId === undefined ? undefined : tripUuid(seriesId);
    return tariffRepository.withLockedSheet(
      context,
      async ({
        sheet,
        frequencyIds,
        frequencyQueryPort,
        freeze,
        toEntity,
        programmingSession,
        commercialSession,
      }) => {
        if (sheet.status === 'PUBLISHED') {
          if (!sheet.tariff_frozen)
            throw new TariffConflictError(
              'ROUTE_TARIFF_FROZEN_MISSING',
              'La hoja publicada no tiene una copia comercial verificable.',
            );
          assertRevision(expectedRevision, sheet.tariff_frozen_revision);
          restoreTariffSnapshot(sheet.tariff_frozen, sheet.tariff_frozen_revision);
          if (expectedProgrammingRevision !== undefined) {
            const session = await programmingSession?.();
            assertProgrammingRevision(expectedProgrammingRevision, session?.record?.revision ?? 0);
          }
          if (!commercialSession?.findPublished) throw new CommercialTripSourceError();
          const commercial = await commercialSession.findPublished();
          if (requestedSeriesId !== undefined && requestedSeriesId !== commercial?.seriesId)
            throw new CommercialTripConflictError(
              'COMMERCIAL_SERIES_CONFLICT',
              'La publicación no corresponde a la serie solicitada.',
            );
          return Object.assign(RouteSheetDTO.fromEntity(toEntity(sheet), [], []), { commercial });
        }
        if (sheet.status !== 'DRAFT')
          throw new TariffConflictError(
            'ROUTE_TARIFF_NOT_EDITABLE',
            'La hoja no puede publicarse en su estado actual.',
          );
        assertRevision(expectedRevision, sheet.tariff_revision);
        const snapshot = await validateTariffForPublication({
          sheet,
          frequencyIds,
          frequencyQueryPort,
        });
        const session = await programmingSession?.();
        await validateProgrammingForPublication({
          programmingSession: async () => session,
          busQueryPort,
          sheet: { ...sheet, routeDate: sheet.programming_route_date },
          cooperativeId: context.cooperativeId,
          expectedProgrammingRevision,
          frequencyQueryPort,
          now: now(),
        });
        const capture = await prepareCommercialPublication({
          commercialSession,
          programmingRecord: session.record,
          seatQueryPort,
          seriesId: requestedSeriesId,
          now: now(),
        });
        const commercial = await commercialSession.save(capture);
        const saved = await freeze(snapshot);
        return Object.assign(RouteSheetDTO.fromEntity(saved, [], []), { commercial });
      },
    );
  };
}

module.exports = publishRouteSheetUseCase;
