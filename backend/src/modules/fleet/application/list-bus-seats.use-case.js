const { createBusSeatQuery } = require('../domain/bus-seat-query');

function listBusSeats({ repository }) {
  return async (input) => {
    const { busId, cooperativeId } = createBusSeatQuery(input);
    const inventory = await repository.listSeats(busId, cooperativeId);
    if (!inventory) return null;
    return Object.freeze({
      busId: inventory.busId,
      seats: Object.freeze(inventory.seats.map((seat) => Object.freeze({ ...seat }))),
    });
  };
}

module.exports = listBusSeats;
