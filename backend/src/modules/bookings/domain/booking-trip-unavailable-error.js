class BookingTripUnavailableError extends Error {
  constructor() {
    super('El viaje no está disponible para consultar asientos.');
    this.name = 'BookingTripUnavailableError';
    this.code = 'BOOKING_TRIP_UNAVAILABLE';
  }
}

module.exports = BookingTripUnavailableError;
