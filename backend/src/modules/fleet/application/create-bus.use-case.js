const { createBusRegistrationData } = require('../domain/bus-registration');
const { createBusSeatConfiguration } = require('../domain/bus-seat-configuration');
const { BusRegistrationForbiddenError } = require('../domain/bus-registration-error');

function createBus({ catalog, persist, newId }) {
  return async ({ data: input, photos }, actor) => {
    if (actor?.role !== 'COOPERATIVE_ADMIN' || !actor?.cooperative_id) {
      throw new BusRegistrationForbiddenError();
    }
    const data = createBusRegistrationData(input);
    const layouts = await catalog.list();
    const layout = layouts.find(
      (entry) => entry.id === data.seatLayoutId && entry.version === data.seatLayoutVersion,
    );
    const configuration = createBusSeatConfiguration(data, layout);
    return persist({
      id: newId(),
      cooperativeId: actor.cooperative_id,
      data,
      configuration,
      photos,
    });
  };
}

module.exports = createBus;
