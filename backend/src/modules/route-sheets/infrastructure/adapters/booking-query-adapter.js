const BookingQueryPort = require('../../domain/ports/booking-query-port');

class BookingQueriesUnavailableError extends Error {
  constructor() {
    super('No está disponible el proveedor de consultas de reservas.');
    this.name = 'BookingQueriesUnavailableError';
    this.code = 'BOOKING_QUERIES_UNAVAILABLE';
    this.httpStatus = 503;
  }
}

class BookingQueryAdapter extends BookingQueryPort {
  constructor({ bookingQueries } = {}) {
    super();
    this.bookingQueries = bookingQueries;

    if (bookingQueries) {
      const requiredMethods = ['hasPassengersForBusOnRouteSheet', 'hasPassengersForAssignment'];
      const missingMethods = requiredMethods.filter(
        (method) => typeof bookingQueries[method] !== 'function',
      );
      if (missingMethods.length > 0) {
        throw new TypeError(`bookingQueries requiere: ${missingMethods.join(', ')}.`);
      }
    }
  }

  async hasPassengersForBusOnRouteSheet(routeSheetId, busId, cooperativeId) {
    return this.#query('hasPassengersForBusOnRouteSheet', [routeSheetId, busId, cooperativeId]);
  }

  async hasPassengersForAssignment(assignmentId, cooperativeId) {
    return this.#query('hasPassengersForAssignment', [assignmentId, cooperativeId]);
  }

  async #query(method, args) {
    if (!this.bookingQueries) throw new BookingQueriesUnavailableError();
    const result = await this.bookingQueries[method](...args);
    if (typeof result !== 'boolean') {
      throw new TypeError(`bookingQueries.${method} debe devolver un booleano.`);
    }
    return result;
  }
}

module.exports = BookingQueryAdapter;
module.exports.BookingQueriesUnavailableError = BookingQueriesUnavailableError;
