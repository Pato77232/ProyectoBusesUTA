const BusQueryPort = require('../../domain/ports/bus-query-port');

class BusQueryAdapter extends BusQueryPort {
  constructor({ busQueries }) {
    super();
    this.busQueries = busQueries;
  }

  async findByCooperativeId(cooperativeId) {
    return this.busQueries.findByCooperativeId(cooperativeId);
  }

  async findByBusGroupId(busGroupId, cooperativeId) {
    return this.busQueries.findByBusGroupId(busGroupId, cooperativeId);
  }

  async findById(id, cooperativeId) {
    return this.busQueries.findById(id, cooperativeId);
  }
}

module.exports = BusQueryAdapter;
