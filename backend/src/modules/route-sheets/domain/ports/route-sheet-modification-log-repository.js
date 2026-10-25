class RouteSheetModificationLogRepository {
  async save(log) {
    throw new Error('Method not implemented');
  }

  async findByRouteSheetId(routeSheetId, cooperativeId) {
    throw new Error('Method not implemented');
  }

  async findByFilters(cooperativeId, filters) {
    throw new Error('Method not implemented');
  }
}

module.exports = RouteSheetModificationLogRepository;
