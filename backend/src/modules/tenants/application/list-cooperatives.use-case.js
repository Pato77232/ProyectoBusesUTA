const CooperativeError = require('../domain/cooperative-error');

function listCooperatives({ repository }) {
  return async (actor) => {
    if (actor?.role !== 'SYSTEM_ADMIN') throw new CooperativeError('FORBIDDEN');
    return repository.listSummary();
  };
}

module.exports = listCooperatives;
