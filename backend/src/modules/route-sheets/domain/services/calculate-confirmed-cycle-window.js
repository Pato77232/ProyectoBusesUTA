const { parseScheduledInstant } = require('../value-objects/scheduled-instant');
const { createDayCyclePeriod, toScheduledIso } = require('../value-objects/day-cycle-period');
const {
  requireObject,
  requireText,
  readList,
  requireUnique,
  assertContext,
} = require('../value-objects/programming-input');
const {
  RouteProgrammingValidationError,
  RouteProgrammingConflictError,
} = require('../errors/route-programming-errors');

const MAX_UNFINISHED_CYCLES = 2;

function readCycle(value, context, cycleLengthDays) {
  assertContext(value, context);
  if (!['DRAFT', 'PUBLISHED'].includes(value.status)) {
    throw new RouteProgrammingValidationError('Estado de ciclo inválido.');
  }
  const period = createDayCyclePeriod({ cycleStartDate: value.startDate, cycleLengthDays });
  return {
    id: requireText(value.id, 'id del ciclo'),
    ...context,
    startDate: value.startDate,
    status: value.status,
    startMs: period.startMs,
    endMs: period.endMs,
  };
}

function assertConsecutive(cycles, period) {
  let expected = period.startMs;
  let hasDraft = false;
  for (const cycle of cycles) {
    if (cycle.startMs !== expected || (hasDraft && cycle.status === 'PUBLISHED')) {
      throw new RouteProgrammingConflictError(
        'ROUTE_CYCLE_SEQUENCE_CONFLICT',
        'Los ciclos deben ser consecutivos y no publicarse después de un borrador.',
      );
    }
    hasDraft = hasDraft || cycle.status === 'DRAFT';
    expected = cycle.endMs;
  }
}

function freezeCycle(cycle) {
  return Object.freeze({
    id: cycle.id,
    cooperativeId: cycle.cooperativeId,
    busGroupId: cycle.busGroupId,
    startDate: cycle.startDate,
    status: cycle.status,
    startAt: toScheduledIso(cycle.startMs),
    endExclusive: toScheduledIso(cycle.endMs),
  });
}

function calculateConfirmedCycleWindow(input) {
  requireObject(input, 'Ventana de ciclos');
  const context = {
    cooperativeId: requireText(input.cooperativeId, 'cooperativeId'),
    busGroupId: requireText(input.busGroupId, 'busGroupId'),
  };
  const period = createDayCyclePeriod(input);
  const now = parseScheduledInstant(input.now, 'now');
  const boardingAt = parseScheduledInstant(input.boardingAt, 'boardingAt');
  const cycles = readList(input.cycles, 'cycles', (value) =>
    readCycle(value, context, period.cycleLengthDays),
  ).sort((left, right) => left.startMs - right.startMs);
  requireUnique(
    cycles.map(({ id }) => id),
    'Ciclos',
  );
  assertConsecutive(cycles, period);
  const unfinished = cycles.filter(({ endMs }) => endMs > now);
  if (unfinished.length > MAX_UNFINISHED_CYCLES) {
    throw new RouteProgrammingConflictError(
      'ROUTE_CYCLE_LIMIT_EXCEEDED',
      'No se admiten más de dos ciclos no terminados.',
    );
  }
  const published = unfinished.filter(({ status }) => status === 'PUBLISHED');
  const lastPublished = published[published.length - 1];
  const first = published[0];
  const boardingCycle = published.find(
    ({ startMs, endMs }) => startMs <= boardingAt && boardingAt < endMs,
  );
  const hasEnded = cycles.some(({ endMs }) => endMs <= now);
  return Object.freeze({
    ...context,
    cycleStartDate: period.cycleStartDate,
    cycleLengthDays: period.cycleLengthDays,
    confirmedFromInclusive: first ? toScheduledIso(first.startMs) : null,
    confirmedThroughExclusive: lastPublished ? toScheduledIso(lastPublished.endMs) : null,
    boardingAllowed: Boolean(boardingCycle && now < boardingAt),
    boardingCycleId: boardingCycle ? boardingCycle.id : null,
    remainingCycleSlots: MAX_UNFINISHED_CYCLES - unfinished.length,
    renewalAllowed:
      hasEnded &&
      unfinished.length < MAX_UNFINISHED_CYCLES &&
      cycles.every(({ status }) => status === 'PUBLISHED'),
    nextCycleStartAt: cycles.length
      ? toScheduledIso(cycles[cycles.length - 1].endMs)
      : period.startAt,
    cycles: Object.freeze(cycles.map(freezeCycle)),
  });
}

module.exports = calculateConfirmedCycleWindow;
