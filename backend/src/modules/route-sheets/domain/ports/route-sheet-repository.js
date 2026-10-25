class RouteSheetRepository {
  async findById(id, cooperativeId) {
    throw new Error('Method not implemented');
  }

  async findByDateAndGroup(cooperativeId, busGroupId, routeDate) {
    throw new Error('Method not implemented');
  }

  async findAll(cooperativeId, filters) {
    throw new Error('Method not implemented');
  }

  async findBaseForCycles(id, cooperativeId) {
    throw new Error('Method not implemented');
  }

  async save(routeSheet) {
    throw new Error('Method not implemented');
  }

  async existsByDateAndGroup(cooperativeId, busGroupId, routeDate) {
    throw new Error('Method not implemented');
  }
}

module.exports = RouteSheetRepository;
