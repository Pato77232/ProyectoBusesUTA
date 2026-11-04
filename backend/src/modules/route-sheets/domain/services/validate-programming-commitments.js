const validateBusAgenda = require('./validate-bus-agenda');
const { RouteProgrammingConflictError } = require('../errors/route-programming-errors');
const { parseScheduledInstant } = require('../value-objects/scheduled-instant');
const MAX_UNFINISHED_CYCLES = 2;

function conflict(code, message) {
  throw new RouteProgrammingConflictError(code, message);
}

function validateProgrammingCommitments(
  candidate,
  { programs: others, hasLegacyConflicts, hasLegacyCycles },
  now,
) {
  const nowMs = parseScheduledInstant(now, 'now');
  if (hasLegacyConflicts || hasLegacyCycles)
    conflict(
      'ROUTE_PROGRAMMING_LEGACY_UNVERIFIABLE',
      'Hay compromisos legados sin programación verificable; regularízalos antes de continuar.',
    );
  const sameGroup = others.filter((p) => p.busGroupId === candidate.busGroupId);
  const periods = [...sameGroup, candidate].sort(
    (a, b) => Date.parse(a.startAt) - Date.parse(b.startAt),
  );
  if (periods.filter((p) => Date.parse(p.endExclusive) > nowMs).length > MAX_UNFINISHED_CYCLES)
    conflict(
      'ROUTE_CYCLE_LIMIT_EXCEEDED',
      'No se admiten más de dos ciclos no terminados por grupo.',
    );
  for (let index = 1; index < periods.length; index++) {
    if (Date.parse(periods[index].startAt) < Date.parse(periods[index - 1].endExclusive))
      conflict('ROUTE_CYCLE_SEQUENCE_CONFLICT', 'Los ciclos del grupo no pueden superponerse.');
  }
  // Todos los compromisos del bus, no solo los que empiezan dentro del ciclo.
  const busIds = new Set(
    [...candidate.agendas, ...others.flatMap((p) => p.agendas)].map((a) => a.busId),
  );
  for (const busId of busIds) {
    const agendas = [candidate, ...others]
      .flatMap((p) => p.agendas)
      .filter((a) => a.busId === busId);
    const activities = agendas.flatMap((a) => a.activities);
    const blocks = agendas.flatMap((a) => a.blocks);
    if (!activities.length) continue;
    const ordered = [...activities].sort(
      (a, b) => Date.parse(a.departureAt) - Date.parse(b.departureAt),
    );
    const initial = [...agendas].sort(
      (a, b) =>
        Date.parse(a.initialAvailability.availableAt) -
        Date.parse(b.initialAvailability.availableAt),
    )[0].initialAvailability;
    validateBusAgenda({
      busId,
      cooperativeId: candidate.cooperativeId,
      initialAvailability: initial,
      activities: ordered,
      blocks,
    });
    // Una disponibilidad declarada no puede contradecir el último compromiso conocido.
    for (const agenda of agendas) {
      const at = Date.parse(agenda.initialAvailability.availableAt);
      const ownIds = new Set(agenda.activities.map((a) => a.id));
      const previous = ordered
        .filter((a) => !ownIds.has(a.id) && Date.parse(a.departureAt) <= at)
        .at(-1);
      if (
        previous &&
        (Date.parse(previous.readyAt) > at ||
          previous.destinationKey !== agenda.initialAvailability.locationKey)
      )
        conflict(
          'ROUTE_PROGRAMMING_AVAILABILITY_CONFLICT',
          'La disponibilidad inicial contradice un compromiso del bus.',
        );
    }
  }
}

module.exports = validateProgrammingCommitments;
