const BusGroupQueryPort = require('../../domain/ports/bus-group-query-port');

class BusGroupQueryAdapter extends BusGroupQueryPort {
  constructor({ busGroupRepository }) {
    super();
    this.busGroupRepository = busGroupRepository;
  }

  async findByCooperativeId(cooperativeId) {
    if (this.busGroupRepository.listByCooperative) {
      return this.busGroupRepository.listByCooperative(cooperativeId);
    }
    if (this.busGroupRepository.findByCooperativeId) {
      return this.busGroupRepository.findByCooperativeId(cooperativeId);
    }
    return [];
  }

  async findById(id, cooperativeId) {
    if (this.busGroupRepository.findById) {
      return this.busGroupRepository.findById(id, cooperativeId);
    }
    return null;
  }
}

module.exports = BusGroupQueryAdapter;
