const BusGroupQueryPort = require('../../domain/ports/bus-group-query-port');

class BusGroupQueryAdapter extends BusGroupQueryPort {
  constructor({ busGroupQueries }) {
    super();
    this.busGroupQueries = busGroupQueries;
  }

  async findByCooperativeId(cooperativeId) {
    return this.busGroupQueries.findByCooperativeId(cooperativeId);
  }

  async findById(id, cooperativeId) {
    return this.busGroupQueries.findById(id, cooperativeId);
  }
}

module.exports = BusGroupQueryAdapter;
