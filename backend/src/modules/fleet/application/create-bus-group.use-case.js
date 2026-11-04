const { createBusGroupData } = require('../domain/bus-group');
const BusGroupError = require('../domain/bus-group-error');

function createBusGroup({ repository }) {
  return async (input, actor) => {
    if (actor?.role !== 'COOPERATIVE_ADMIN' || !actor?.cooperative_id) {
      throw new BusGroupError('FORBIDDEN');
    }
    return repository.create(actor.cooperative_id, createBusGroupData(input));
  };
}

module.exports = createBusGroup;
module.exports.BusGroupError = BusGroupError;
