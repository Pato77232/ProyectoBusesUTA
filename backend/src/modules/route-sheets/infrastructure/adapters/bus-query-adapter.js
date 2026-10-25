const BusQueryPort = require('../../domain/ports/bus-query-port');

class BusQueryAdapter extends BusQueryPort {
  constructor({ busRepository }) {
    super();
    this.busRepository = busRepository;
  }

  async findByCooperativeId(cooperativeId) {
    if (this.busRepository.findByCooperativeId) {
      return this.busRepository.findByCooperativeId(cooperativeId);
    }
    if (this.busRepository.listByCooperative) {
      return this.busRepository.listByCooperative(cooperativeId);
    }
    return [];
  }

  async findByBusGroupId(busGroupId, cooperativeId) {
    if (this.busRepository.findByBusGroupId) {
      return this.busRepository.findByBusGroupId(busGroupId, cooperativeId);
    }
    if (this.busRepository.listByBusGroup) {
      return this.busRepository.listByBusGroup(busGroupId, cooperativeId);
    }
    return [];
  }

  async findById(id, cooperativeId) {
    if (this.busRepository.findById) {
      return this.busRepository.findById(id, cooperativeId);
    }
    return null;
  }
}

module.exports = BusQueryAdapter;
