class BookingQueryPort {
  async hasPassengersForBusOnRouteSheet(routeSheetId, busId, cooperativeId) {
    throw new Error('Method not implemented');
  }

  async hasPassengersForAssignment(assignmentId, cooperativeId) {
    throw new Error('Method not implemented');
  }
}

module.exports = BookingQueryPort;
