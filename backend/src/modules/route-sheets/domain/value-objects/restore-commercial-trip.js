const { tripUuid, commercialInventory } = require('./commercial-inventory');
const restoreTariff = require('./restore-tariff-snapshot');
const { parseScheduledInstant, calculateReadyAt } = require('./scheduled-instant');
const { createDayCyclePeriod } = require('./day-cycle-period');
const { CommercialTripSourceError } = require('../errors/commercial-trip-errors');

const CONTINENTAL_OFFSET_MS = -5 * 60 * 60 * 1000;
function requireSource(condition) {
  if (!condition) throw new CommercialTripSourceError();
}
const sameInstant = (a, b) =>
  parseScheduledInstant(a, 'instante') === parseScheduledInstant(b, 'instante');

function routePointsFor(trip) {
  requireSource(Array.isArray(trip.routePoints) && trip.routePoints.length >= 2);
  let previous = parseScheduledInstant(trip.departureAt, 'departureAt');
  const end = parseScheduledInstant(trip.arrivalAt, 'arrivalAt');
  requireSource(end > previous);
  const points = Array.from(trip.routePoints, (point, index) => {
    const first = index === 0,
      last = index === trip.routePoints.length - 1;
    requireSource(
      point &&
        point.position === index &&
        typeof point.locationKey === 'string' &&
        point.locationKey.trim(),
    );
    requireSource(first ? point.arrivalAt === undefined : typeof point.arrivalAt === 'string');
    requireSource(last ? point.departureAt === undefined : typeof point.departureAt === 'string');
    const arrival = parseScheduledInstant(first ? point.departureAt : point.arrivalAt, 'arrivalAt');
    const departure = parseScheduledInstant(
      last ? point.arrivalAt : point.departureAt,
      'departureAt',
    );
    requireSource(arrival >= previous && departure >= arrival && departure <= end);
    previous = departure;
    return Object.freeze({
      position: index,
      locationKey: point.locationKey.trim().normalize('NFC'),
      ...(!first ? { arrivalAt: new Date(arrival).toISOString() } : {}),
      ...(!last ? { departureAt: new Date(departure).toISOString() } : {}),
    });
  });
  requireSource(
    sameInstant(points[0].departureAt, trip.departureAt) &&
      sameInstant(points.at(-1).arrivalAt, trip.arrivalAt),
  );
  return Object.freeze(points);
}

function restore(snapshot, requestedId) {
  const { trip, sheet, programming, assignment, required, inventory, cycle, series, cycles } =
    snapshot;
  requireSource(
    trip &&
      sheet &&
      programming &&
      assignment &&
      required &&
      inventory &&
      cycle &&
      series &&
      Array.isArray(cycles) &&
      cycles.length > 0,
  );
  const fields = [
    'id',
    'cooperativeId',
    'routeSheetId',
    'assignmentId',
    'requiredServiceId',
    'frequencyId',
    'busId',
    'cycleId',
    'inventorySnapshotId',
  ];
  for (const field of fields) requireSource(tripUuid(trip[field]) === trip[field]);
  requireSource(
    trip.id === requestedId &&
      sheet.id === trip.routeSheetId &&
      sheet.cooperativeId === trip.cooperativeId,
  );
  requireSource(['DRAFT', 'PUBLISHED'].includes(sheet.status));
  requireSource(
    Number.isSafeInteger(trip.programmingRevision) &&
      trip.programmingRevision > 0 &&
      Number.isSafeInteger(trip.tariffRevision) &&
      trip.tariffRevision > 0,
  );
  requireSource(
    programming.revision === trip.programmingRevision &&
      sheet.tariffRevision === trip.tariffRevision,
  );
  requireSource(
    assignment.id === trip.assignmentId &&
      assignment.requiredServiceId === trip.requiredServiceId &&
      assignment.frequencyId === trip.frequencyId &&
      assignment.busId === trip.busId,
  );
  requireSource(
    required.id === trip.requiredServiceId &&
      required.frequencyId === trip.frequencyId &&
      sameInstant(required.departureAt, trip.departureAt),
  );
  requireSource(
    sameInstant(assignment.departureAt, trip.departureAt) &&
      sameInstant(assignment.arrivalAt, trip.arrivalAt),
  );
  requireSource(
    cycle.id === trip.cycleId &&
      cycle.routeSheetId === trip.routeSheetId &&
      cycle.programmingRevision === trip.programmingRevision &&
      cycle.tariffRevision === trip.tariffRevision,
  );
  requireSource(
    sameInstant(cycle.startAt, programming.startAt) &&
      sameInstant(cycle.endExclusive, programming.endExclusive),
  );
  requireSource(
    Date.parse(trip.departureAt) >= Date.parse(cycle.startAt) &&
      calculateReadyAt(Date.parse(trip.arrivalAt), assignment.preparationMinutes) <=
        Date.parse(cycle.endExclusive),
  );
  requireSource(
    series.id === cycle.seriesId &&
      series.cooperativeId === trip.cooperativeId &&
      series.busGroupId === sheet.busGroupId,
  );
  const base = createDayCyclePeriod({
    cycleStartDate: series.baseStartDate,
    cycleLengthDays: series.cycleLengthDays,
  });
  requireSource(sameInstant(base.startAt, series.baseStartAt));
  let hasDraft = false;
  const cycleIds = new Set(),
    sheetIds = new Set();
  const normalizedCycles = Array.from(cycles, (item, index) => {
    requireSource(
      tripUuid(item.id) === item.id &&
        tripUuid(item.routeSheetId) === item.routeSheetId &&
        item.cycleNumber === index + 1,
    );
    requireSource(
      !cycleIds.has(item.id) &&
        !sheetIds.has(item.routeSheetId) &&
        item.busGroupId === sheet.busGroupId,
    );
    cycleIds.add(item.id);
    sheetIds.add(item.routeSheetId);
    requireSource(
      Date.parse(item.startAt) === base.startMs + index * base.durationMs &&
        Date.parse(item.endExclusive) === base.startMs + (index + 1) * base.durationMs,
    );
    requireSource(
      ['DRAFT', 'PUBLISHED'].includes(item.status) && !(hasDraft && item.status === 'PUBLISHED'),
    );
    hasDraft = hasDraft || item.status === 'DRAFT';
    if (index === 0) requireSource(item.routeSheetId === series.baseRouteSheetId);
    return Object.freeze({
      ...item,
      cooperativeId: trip.cooperativeId,
      startDate: new Date(base.startMs + index * base.durationMs + CONTINENTAL_OFFSET_MS)
        .toISOString()
        .slice(0, 10),
    });
  });
  const own = normalizedCycles.find((item) => item.id === trip.cycleId);
  requireSource(
    own &&
      own.routeSheetId === trip.routeSheetId &&
      own.cycleNumber === cycle.cycleNumber &&
      own.status === sheet.status &&
      sameInstant(own.startAt, cycle.startAt) &&
      sameInstant(own.endExclusive, cycle.endExclusive),
  );
  requireSource(
    inventory.id === trip.inventorySnapshotId &&
      inventory.busId === trip.busId &&
      inventory.revision === 1 &&
      inventory.schemaVersion === 1 &&
      inventory.snapshot?.schemaVersion === 1,
  );
  requireSource(
    Array.isArray(inventory.snapshot.seats) &&
      inventory.snapshot.seats.every((s) => s?.offered === true),
  );
  const offered = commercialInventory(inventory.snapshot, trip.busId);
  const points = routePointsFor(trip);
  const tariff = restoreTariff(sheet.tariff, trip.tariffRevision);
  const frequencyTariff = tariff.frequencies.find((f) => f.frequencyId === trip.frequencyId);
  requireSource(
    frequencyTariff &&
      JSON.stringify(frequencyTariff.routePoints) ===
        JSON.stringify(points.map((p) => p.locationKey)),
  );
  return {
    trip,
    sheet,
    series,
    cycle,
    cycles: Object.freeze(normalizedCycles),
    inventoryRevision: inventory.revision,
    points,
    seatIds: Object.freeze(offered.seats.map((s) => s.seatId)),
    seats: offered.seats,
    tariff,
    prices: frequencyTariff.prices,
  };
}

function restoreCommercialTrip(snapshot, requestedId) {
  try {
    return restore(snapshot, requestedId);
  } catch {
    throw new CommercialTripSourceError();
  }
}
module.exports = restoreCommercialTrip;
