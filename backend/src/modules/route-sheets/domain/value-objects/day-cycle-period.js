const { parseScheduledInstant } = require('./scheduled-instant');
const { RouteProgrammingValidationError } = require('../errors/route-programming-errors');

const MILLISECONDS_PER_DAY = 86_400_000;
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CONTINENTAL_OFFSET = '-05:00';

function toScheduledIso(timestamp) {
  const date = new Date(timestamp);
  if (
    !Number.isSafeInteger(timestamp) ||
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() < 0 ||
    date.getUTCFullYear() > 9999
  ) {
    throw new RouteProgrammingValidationError('El período excede las fechas admitidas.');
  }
  return date.toISOString();
}

function createDayCyclePeriod({ cycleStartDate, cycleLengthDays }) {
  if (typeof cycleStartDate !== 'string' || !LOCAL_DATE.test(cycleStartDate)) {
    throw new RouteProgrammingValidationError('cycleStartDate requiere fecha local YYYY-MM-DD.');
  }
  if (!Number.isSafeInteger(cycleLengthDays) || cycleLengthDays <= 0) {
    throw new RouteProgrammingValidationError(
      'cycleLengthDays debe ser un entero positivo explícito.',
    );
  }
  const startMs = parseScheduledInstant(
    `${cycleStartDate}T00:00:00${CONTINENTAL_OFFSET}`,
    'cycleStartDate',
  );
  const durationMs = cycleLengthDays * MILLISECONDS_PER_DAY;
  if (!Number.isSafeInteger(durationMs)) {
    throw new RouteProgrammingValidationError('La duración excede el intervalo admitido.');
  }
  const endMs = startMs + durationMs;
  return Object.freeze({
    cycleStartDate,
    cycleLengthDays,
    startMs,
    endMs,
    durationMs,
    startAt: toScheduledIso(startMs),
    endExclusive: toScheduledIso(endMs),
  });
}

module.exports = { createDayCyclePeriod, toScheduledIso };
