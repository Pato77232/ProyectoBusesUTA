const { renewalUuid, readRenewalRequest } = require('../value-objects/renewal-request');
const restoreTariff = require('../value-objects/restore-tariff-snapshot');
const { createDayCyclePeriod } = require('../value-objects/day-cycle-period');
const { parseScheduledInstant } = require('../value-objects/scheduled-instant');
const { validateRenewalProgramming, shiftRenewalProgramming } = require('./renewal-programming');
const validateCommitments = require('./validate-programming-commitments');
const planCycle = require('./plan-commercial-cycle');
const { CommercialTripConflictError } = require('../errors/commercial-trip-errors');
const {
  RenewalConflictError,
  RenewalSourceError,
  RenewalNotFoundError,
} = require('../errors/route-renewal-errors');

function conflict(code, message) {
  throw new RenewalConflictError(code, message);
}

function frozen(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(frozen);
    Object.freeze(value);
  }
  return value;
}

function assertSource(source, request, context, series) {
  if (
    source === null ||
    (source &&
      (source.routeSheetId !== request.sourceRouteSheetId ||
        source.cooperativeId !== context.cooperativeId))
  )
    throw new RenewalNotFoundError();
  if (
    !source ||
    !series ||
    !Array.isArray(series.cycles) ||
    !series.cycles.length ||
    series.cycles.some((cycle) => !cycle || typeof cycle !== 'object')
  )
    throw new RenewalSourceError();
  if (source.status !== 'PUBLISHED')
    conflict('ROUTE_RENEWAL_NOT_PUBLISHED', 'El origen debe ser una hoja publicada.');
  if (
    source.programmingRevision !== request.expectedProgrammingRevision ||
    source.tariffRevision !== request.expectedTariffRevision
  )
    conflict('ROUTE_RENEWAL_REVISION_CONFLICT', 'Las revisiones del origen no coinciden.');
  if (
    series.id !== source.seriesId ||
    series.cooperativeId !== context.cooperativeId ||
    series.busGroupId !== source.busGroupId
  )
    throw new RenewalSourceError();
  if (series.cycles.at(-1).routeSheetId !== source.routeSheetId)
    conflict('ROUTE_RENEWAL_NOT_LATEST', 'Solo se renueva el último ciclo publicado de la serie.');
}

function allocator(source, programming, newId) {
  if (typeof newId !== 'function') throw new RenewalSourceError();
  const used = new Set([
    source.routeSheetId,
    source.seriesId,
    ...programming.requiredServices.map((entry) => entry.id),
    ...programming.agendas.flatMap((agenda) =>
      [...agenda.activities, ...agenda.blocks].map((entry) => entry.id),
    ),
  ]);
  return () => {
    let id;
    try {
      id = renewalUuid(newId());
    } catch {
      throw new RenewalSourceError();
    }
    if (used.has(id)) throw new RenewalSourceError();
    used.add(id);
    return id;
  };
}

function readSourceProgramming(source, context) {
  try {
    const tariff = restoreTariff(source.tariff, source.tariffRevision);
    return { ...validateRenewalProgramming(source.programming, tariff, context), tariff };
  } catch {
    throw new RenewalSourceError();
  }
}

function planNextCycle(series, programming, now) {
  try {
    return planCycle({ series: [series], seriesId: series.id, programming, now });
  } catch (error) {
    if (error instanceof CommercialTripConflictError) throw error;
    throw new RenewalSourceError();
  }
}

// Plan puro: el futuro caso de uso revalida proveedores y persiste bajo ADR 0006.
function planRouteSheetRenewal({
  request: input,
  context: actor,
  source,
  series,
  commitments,
  now,
  newId,
}) {
  const request = readRenewalRequest(input);
  const context = {
    cooperativeId: renewalUuid(actor?.cooperativeId),
    modifiedBy: renewalUuid(actor?.modifiedBy),
  };
  assertSource(source, request, context, series);
  const group = {
    cooperativeId: context.cooperativeId,
    busGroupId: renewalUuid(source.busGroupId),
  };
  const original = readSourceProgramming(source, group);
  const period = createDayCyclePeriod(original.programming);
  const last = series.cycles.at(-1);
  if (last.startAt !== period.startAt || last.endExclusive !== period.endExclusive)
    throw new RenewalSourceError();
  const allocateId = allocator(source, original.programming, newId);
  const shifted = shiftRenewalProgramming(original.programming, allocateId);
  const candidate = validateRenewalProgramming(shifted, original.tariff, group);
  if (Date.parse(candidate.pattern.endExclusive) <= parseScheduledInstant(now, 'now'))
    conflict(
      'ROUTE_RENEWAL_PERIOD_PASSED',
      'El siguiente intervalo ya pasó; prepara una nueva base manual.',
    );
  const cycle = planNextCycle(series, candidate.pattern, now);
  if (
    !commitments ||
    !Array.isArray(commitments.programs) ||
    typeof commitments.hasLegacyConflicts !== 'boolean' ||
    typeof commitments.hasLegacyCycles !== 'boolean' ||
    commitments.programs.some(
      (program) => !program || program.cooperativeId !== context.cooperativeId,
    )
  )
    throw new RenewalSourceError();
  validateCommitments(candidate.pattern, commitments, now);
  return frozen({
    request,
    sourceRouteSheetId: source.routeSheetId,
    seriesId: series.id,
    targetCycleNumber: cycle.cycleNumber,
    startAt: candidate.pattern.startAt,
    endExclusive: candidate.pattern.endExclusive,
    createdBy: context.modifiedBy,
    createdAt: new Date(parseScheduledInstant(now, 'now')).toISOString(),
    draft: {
      routeSheetId: allocateId(),
      ...group,
      status: 'DRAFT',
      programmingRevision: 1,
      tariffRevision: 1,
      programming: candidate.programming,
      tariff: original.tariff,
    },
  });
}

module.exports = planRouteSheetRenewal;
