/** Puerto: create(cooperativeId, data) y listByCooperative(cooperativeId). */
class BusGroupRepository {
  async create() {
    throw new Error('BusGroupRepository.create debe implementarse.');
  }
  async listByCooperative() {
    throw new Error('BusGroupRepository.listByCooperative debe implementarse.');
  }
}

module.exports = BusGroupRepository;