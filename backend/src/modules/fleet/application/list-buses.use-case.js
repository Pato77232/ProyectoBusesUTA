const { assertBusQueryActor } = require('../domain/bus-query-error');

function listBuses({ repository }) {
  return async (actor) => {
    const cooperativeId = assertBusQueryActor(actor);
    return repository.listAdminBuses(cooperativeId);
  };
}

module.exports = listBuses;
