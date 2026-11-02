const { uuid } = require('../../domain/value-objects/programming-request');
const { ProgrammingSourceError } = require('../../domain/errors/programming-persistence-errors');

function getRouteSheetProgramming({ programmingRepository }) {
  return async ({ routeSheetId, cooperativeId }) => {
    const context = { routeSheetId: uuid(routeSheetId), cooperativeId: uuid(cooperativeId) };
    if (!programmingRepository?.findSnapshot) throw new ProgrammingSourceError();
    return programmingRepository.findSnapshot(context);
  };
}

module.exports = getRouteSheetProgramming;
