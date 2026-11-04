const { parseProgrammingRequest } = require('../../domain/value-objects/programming-request');
const editInput = require('../../domain/value-objects/programming-edit-input');
const {
  RouteProgrammingConflictError,
  RouteProgrammingValidationError,
} = require('../../domain/errors/route-programming-errors');
const { ProgrammingSourceError } = require('../../domain/errors/programming-persistence-errors');
const prepare = require('./prepare-route-programming');
const validateCommitments = require('../../domain/services/validate-programming-commitments');

function assertProgrammingRevision(expected, current) {
  if (expected === undefined) return;
  if (!Number.isSafeInteger(expected) || expected < 1)
    throw new RouteProgrammingValidationError(
      'expectedProgrammingRevision debe ser un entero positivo.',
    );
  if (expected !== current)
    throw new RouteProgrammingConflictError(
      'ROUTE_PROGRAMMING_REVISION_CONFLICT',
      'La programación cambió antes de publicar; consulta su revisión actual.',
    );
}

async function validateSnapshot({
  programmingSession,
  busQueryPort,
  sheet,
  cooperativeId,
  expectedProgrammingRevision,
  frequencyQueryPort,
  now,
}) {
  if (!programmingSession) throw new ProgrammingSourceError();
  const { record, findCommitments } = await programmingSession();
  if (!record?.programming)
    throw new RouteProgrammingConflictError(
      'ROUTE_PROGRAMMING_REQUIRED',
      'Completa la programación antes de publicar la hoja.',
    );
  assertProgrammingRevision(expectedProgrammingRevision, record.revision);
  let programming;
  try {
    programming = parseProgrammingRequest({
      expectedRevision: 0,
      programming: editInput(record.programming),
    }).programming;
  } catch {
    throw new ProgrammingSourceError();
  }
  const date = sheet.routeDate;
  if (date !== programming.cycleStartDate)
    throw new RouteProgrammingConflictError(
      'ROUTE_PROGRAMMING_DATE_CONFLICT',
      'La fecha de la hoja no coincide con su programación.',
    );
  const candidate = await prepare({
    programming,
    cooperativeId,
    busGroupId: sheet.bus_group_id,
    busQueryPort,
    frequencyQueryPort,
  });
  for (const agenda of candidate.agendas) {
    for (const activity of agenda.activities.filter((a) => a.kind === 'SERVICE')) {
      const stored = record.programming.agendas
        .flatMap((a) => a.activities)
        .find((a) => a.id === activity.id);
      if (
        activity.points.some(
          (point, index) => point.locationKey !== stored.points[index]?.locationKey,
        )
      )
        throw new RouteProgrammingConflictError(
          'ROUTE_PROGRAMMING_ROUTE_CONFLICT',
          'El recorrido cambió; revisa la programación antes de publicar.',
        );
    }
  }
  validateCommitments(candidate, await findCommitments(candidate), now);
}

async function validateProgrammingForPublication(input) {
  try {
    return await validateSnapshot(input);
  } catch (error) {
    if (error.httpStatus) throw error;
    throw new ProgrammingSourceError();
  }
}

module.exports = { validateProgrammingForPublication, assertProgrammingRevision };
