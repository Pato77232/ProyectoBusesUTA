const { parseScheduledInstant } = require('../value-objects/scheduled-instant');
const {
  CommercialTripConflictError,
  CommercialTripSourceError,
} = require('../errors/commercial-trip-errors');
const MAX_UNFINISHED_CYCLES = 2;
const MAX_CYCLE_NUMBER = 2_147_483_647;
const MILLISECONDS_PER_DAY = 86_400_000;

function conflict(message) {
  throw new CommercialTripConflictError('COMMERCIAL_SERIES_CONFLICT', message);
}

function planCommercialCycle({ series, seriesId, programming, now }) {
  const nowMs = parseScheduledInstant(now, 'now');
  const start = Date.parse(programming.startAt),
    end = Date.parse(programming.endExclusive);
  if (
    !Number.isSafeInteger(programming.cycleLengthDays) ||
    programming.cycleLengthDays < 1 ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end - start !== programming.cycleLengthDays * MILLISECONDS_PER_DAY
  )
    throw new CommercialTripSourceError();
  const lastOf = (item) => item.cycles.at(-1);
  for (const item of series) {
    if (!item.cycles.length) throw new CommercialTripSourceError();
    for (let index = 0; index < item.cycles.length; index++) {
      const cycle = item.cycles[index],
        previous = item.cycles[index - 1];
      if (
        cycle.cycleNumber !== index + 1 ||
        cycle.status !== 'PUBLISHED' ||
        Date.parse(cycle.endExclusive) - Date.parse(cycle.startAt) !==
          item.cycleLengthDays * MILLISECONDS_PER_DAY ||
        (!previous && cycle.startAt !== item.baseStartAt) ||
        (previous && cycle.startAt !== previous.endExclusive)
      )
        throw new CommercialTripSourceError();
    }
  }
  if (seriesId === undefined) {
    if (series.some((item) => Date.parse(lastOf(item).endExclusive) > nowMs))
      conflict(
        'El grupo ya tiene una serie vigente; indica su seriesId para enlazar el siguiente ciclo.',
      );
    if (series.some((item) => Date.parse(lastOf(item).endExclusive) > start))
      conflict('La nueva serie no puede preceder o superponerse al cierre de una serie anterior.');
    return {
      seriesId: null,
      cycleNumber: 1,
      baseStartAt: programming.startAt,
      cycleLengthDays: programming.cycleLengthDays,
    };
  }
  const selected = series.find((item) => item.id === seriesId);
  if (!selected) conflict('La serie no está disponible para esta cooperativa y grupo.');
  const last = lastOf(selected);
  if (
    selected.cycleLengthDays !== programming.cycleLengthDays ||
    Date.parse(last.endExclusive) !== start
  )
    conflict('El ciclo debe continuar exactamente la serie y conservar su duración.');
  if (last.cycleNumber >= MAX_CYCLE_NUMBER)
    conflict('La numeración de la serie excede el límite técnico.');
  if (
    selected.cycles.filter((c) => Date.parse(c.endExclusive) > nowMs).length +
      (end > nowMs ? 1 : 0) >
    MAX_UNFINISHED_CYCLES
  )
    conflict('No se admiten más de dos ciclos no terminados.');
  return {
    seriesId: selected.id,
    cycleNumber: last.cycleNumber + 1,
    baseStartAt: selected.baseStartAt,
    cycleLengthDays: selected.cycleLengthDays,
  };
}
module.exports = planCommercialCycle;
