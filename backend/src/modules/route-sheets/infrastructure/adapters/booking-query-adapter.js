const BookingQueryPort = require('../../domain/ports/booking-query-port');

class BookingQueryAdapter extends BookingQueryPort {
  constructor({ bookingRepository }) {
    super();
    this.bookingRepository = bookingRepository;
  }

  async hasPassengersForBusOnRouteSheet(routeSheetId, busId, cooperativeId) {
    if (this.bookingRepository.hasPassengersForBusOnRouteSheet) {
      return this.bookingRepository.hasPassengersForBusOnRouteSheet(routeSheetId, busId, cooperativeId);
    }
    if (this.bookingRepository.hasPassengersForBus) {
      return this.bookingRepository.hasPassengersForBus(routeSheetId, busId, cooperativeId);
    }
    return false;
  }

  async hasPassengersForAssignment(assignmentId, cooperativeId) {
    if (this.bookingRepository.hasPassengersForAssignment) {
      return this.bookingRepository.hasPassengersForAssignment(assignmentId, cooperativeId);
    }
    return false;
  }
}

module.exports = BookingQueryAdapter;
