const {
  BusNotFoundError,
  assertBusQueryActor,
  isBusIdentifier,
} = require('../domain/bus-query-error');

function getBusDetails({ repository }) {
  return async (busId, actor) => {
    const cooperativeId = assertBusQueryActor(actor);
    if (!isBusIdentifier(busId)) throw new BusNotFoundError();
    const bus = await repository.findAdminDetails(busId, cooperativeId);
    if (!bus) throw new BusNotFoundError();
    return bus;
  };
}

module.exports = getBusDetails;
