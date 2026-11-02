const { uuid, parseProgrammingRequest } = require('../../domain/value-objects/programming-request');
const { RouteProgrammingConflictError } = require('../../domain/errors/route-programming-errors');
const { ProgrammingSourceError } = require('../../domain/errors/programming-persistence-errors');
const prepareRouteProgramming = require('../services/prepare-route-programming');
const validateCommitments = require('../../domain/services/validate-programming-commitments');
const {
  assertProgrammingIdentities,
} = require('../../domain/value-objects/programming-identities');

function saveRouteSheetProgramming({
  programmingRepository,
  busQueryPort,
  now = () => new Date().toISOString(),
}) {
  return async ({ routeSheetId, cooperativeId, modifiedBy, expectedRevision, programming }) => {
    const context = {
      routeSheetId: uuid(routeSheetId),
      cooperativeId: uuid(cooperativeId),
      modifiedBy: uuid(modifiedBy),
    };
    const request = parseProgrammingRequest({ expectedRevision, programming });
    if (!programmingRepository) throw new ProgrammingSourceError();
    return programmingRepository.withLockedProgramming(context, async (session) => {
      const { sheet, revision, frequencyQueryPort } = session;
      if (sheet.status !== 'DRAFT')
        throw new RouteProgrammingConflictError(
          'ROUTE_PROGRAMMING_NOT_EDITABLE',
          'Solo se puede programar una hoja en borrador.',
        );
      if (request.expectedRevision !== revision)
        throw new RouteProgrammingConflictError(
          'ROUTE_PROGRAMMING_REVISION_CONFLICT',
          'La programación cambió; consulta su revisión actual.',
        );
      if (sheet.routeDate !== request.programming.cycleStartDate)
        throw new RouteProgrammingConflictError(
          'ROUTE_PROGRAMMING_DATE_CONFLICT',
          'El ciclo debe empezar en la fecha de la hoja.',
        );
      const candidate = await prepareRouteProgramming({
        programming: request.programming,
        cooperativeId: context.cooperativeId,
        busGroupId: sheet.busGroupId,
        busQueryPort,
        frequencyQueryPort,
      });
      const commitments = await session.findCommitments(candidate);
      validateCommitments(candidate, commitments, now());
      assertProgrammingIdentities(candidate, await session.findIdentities(candidate), context);
      return session.save(candidate);
    });
  };
}

module.exports = saveRouteSheetProgramming;
