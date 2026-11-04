const BusGroupError = require('../domain/bus-group-error');

function listBusGroups({ repository }) {
  return async (actor) => {
    if (actor?.role !== 'COOPERATIVE_ADMIN' || !actor?.cooperative_id) {
      throw new BusGroupError('FORBIDDEN');
    }
    return repository.listByCooperative(actor.cooperative_id);
  };
}

module.exports = listBusGroups;
module.exports.BusGroupError = BusGroupError;
