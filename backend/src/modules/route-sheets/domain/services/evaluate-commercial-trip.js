const calculateWindow = require('./calculate-confirmed-cycle-window');
const { parseScheduledInstant } = require('../value-objects/scheduled-instant');
const {
  CommercialTripValidationError,
  CommercialTripSourceError,
} = require('../errors/commercial-trip-errors');

function evaluateCommercialTrip(restored, now, segment) {
  const { trip, sheet, series, cycle, points, seatIds, tariff, prices } = restored;
  if (segment && segment.toPosition >= points.length)
    throw new CommercialTripValidationError('El par queda fuera del recorrido.');
  let nowMs;
  try {
    nowMs = parseScheduledInstant(now, 'now');
  } catch {
    throw new CommercialTripSourceError();
  }
  if (sheet.status !== 'PUBLISHED') return null;
  const point = segment
    ? points[segment.fromPosition]
    : points.slice(0, -1).find((p) => nowMs < Date.parse(p.departureAt));
  if (!point) return null;
  let window;
  try {
    window = calculateWindow({
      cooperativeId: trip.cooperativeId,
      busGroupId: sheet.busGroupId,
      cycleStartDate: series.baseStartDate,
      cycleLengthDays: series.cycleLengthDays,
      cycles: restored.cycles,
      now,
      boardingAt: point.departureAt,
    });
  } catch {
    throw new CommercialTripSourceError();
  }
  if (!window.boardingAllowed || window.boardingCycleId !== cycle.id) return null;
  const dto = {
    tripId: trip.id,
    cooperativeId: trip.cooperativeId,
    routeSheetId: trip.routeSheetId,
    assignmentId: trip.assignmentId,
    requiredServiceId: trip.requiredServiceId,
    frequencyId: trip.frequencyId,
    busId: trip.busId,
    programmingRevision: trip.programmingRevision,
    tariffRevision: trip.tariffRevision,
    inventorySnapshotId: trip.inventorySnapshotId,
    inventoryRevision: restored.inventoryRevision,
    routePointCount: points.length,
    routePoints: points,
    seatIds,
    confirmedThroughExclusive: window.confirmedThroughExclusive,
  };
  if (!segment) return Object.freeze(dto);
  const price = prices.find(
    (p) => p.fromPosition === segment.fromPosition && p.toPosition === segment.toPosition,
  );
  if (!price) throw new CommercialTripSourceError();
  return Object.freeze({
    ...dto,
    ...segment,
    boardingAt: point.departureAt,
    currency: tariff.currency,
    amountCents: price.amountCents,
    policy: tariff.policy,
  });
}
module.exports = evaluateCommercialTrip;
