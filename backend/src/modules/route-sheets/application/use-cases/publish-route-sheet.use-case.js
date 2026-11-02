const RouteSheetDTO = require('../dtos/route-sheet.dto');
const { assertUuid } = require('../../domain/value-objects/draft-tariff');
const restoreTariffSnapshot = require('../../domain/value-objects/restore-tariff-snapshot');
const {
  TariffValidationError,
  TariffConflictError,
  TariffSourceError,
} = require('../../domain/errors/route-tariff-errors');
const validateTariffForPublication = require('../services/validate-tariff-for-publication');

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

function publishRouteSheetUseCase({ tariffRepository }) {
  return async ({ routeSheetId, cooperativeId, publishedBy, expectedRevision }) => {
    if (!tariffRepository) throw new TariffSourceError();
    const context = {
      routeSheetId: assertUuid(routeSheetId),
      cooperativeId: assertUuid(cooperativeId),
      modifiedBy: assertUuid(publishedBy),
    };
    return tariffRepository.withLockedSheet(
      context,
      async ({ sheet, frequencyIds, frequencyQueryPort, freeze, toEntity }) => {
        if (sheet.status === 'PUBLISHED') {
          if (!sheet.tariff_frozen)
            throw new TariffConflictError(
              'ROUTE_TARIFF_FROZEN_MISSING',
              'La hoja publicada no tiene una copia comercial verificable.',
            );
          assertRevision(expectedRevision, sheet.tariff_frozen_revision);
          restoreTariffSnapshot(sheet.tariff_frozen, sheet.tariff_frozen_revision);
          return RouteSheetDTO.fromEntity(toEntity(sheet), [], []);
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
        const saved = await freeze(snapshot);
        return RouteSheetDTO.fromEntity(saved, [], []);
      },
    );
  };
}

module.exports = publishRouteSheetUseCase;
