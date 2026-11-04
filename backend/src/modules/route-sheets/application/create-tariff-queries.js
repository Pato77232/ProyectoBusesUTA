const { assertUuid } = require('../domain/value-objects/draft-tariff');
const restoreTariffSnapshot = require('../domain/value-objects/restore-tariff-snapshot');
const {
  TariffValidationError,
  TariffSourceError,
} = require('../domain/errors/route-tariff-errors');

function createTariffQueries({ tariffRepository }) {
  async function findPublishedByRouteSheetId(routeSheetId, cooperativeId) {
    const id = assertUuid(routeSheetId);
    const tenant = assertUuid(cooperativeId);
    const row = await tariffRepository.findPublishedById(id, tenant);
    if (!row) return null;
    if (row.id !== id || row.cooperative_id !== tenant) throw new TariffSourceError();
    return Object.freeze({
      routeSheetId: row.id,
      cooperativeId: row.cooperative_id,
      busGroupId: row.bus_group_id,
      revision: row.tariff_frozen_revision,
      publishedAt: row.tariff_frozen_at.toISOString(),
      tariff: restoreTariffSnapshot(row.tariff_frozen, row.tariff_frozen_revision),
    });
  }

  async function findPrice(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new TariffValidationError();
    const { routeSheetId, cooperativeId, frequencyId, fromPosition, toPosition } = input;
    const frequency = assertUuid(frequencyId);
    if (
      !Number.isSafeInteger(fromPosition) ||
      fromPosition < 0 ||
      !Number.isSafeInteger(toPosition) ||
      toPosition <= fromPosition
    ) {
      throw new TariffValidationError('Posiciones de recorrido inválidas.');
    }
    const snapshot = await findPublishedByRouteSheetId(routeSheetId, cooperativeId);
    if (!snapshot) return null;
    const tariff = snapshot.tariff.frequencies.find(({ frequencyId: id }) => id === frequency);
    const price = tariff?.prices.find(
      (value) => value.fromPosition === fromPosition && value.toPosition === toPosition,
    );
    if (!price) return null;
    return Object.freeze({
      routeSheetId: snapshot.routeSheetId,
      cooperativeId: snapshot.cooperativeId,
      busGroupId: snapshot.busGroupId,
      frequencyId: frequency,
      fromPosition,
      toPosition,
      revision: snapshot.revision,
      currency: snapshot.tariff.currency,
      amountCents: price.amountCents,
      policy: snapshot.tariff.policy,
    });
  }

  return Object.freeze({ findPublishedByRouteSheetId, findPrice });
}

module.exports = createTariffQueries;
