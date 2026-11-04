class BookingTripIntegrityError extends Error {
  constructor() {
    super('No se pudo verificar la información del viaje.');
    this.name = 'BookingTripIntegrityError';
    this.code = 'BOOKING_TRIP_DATA_INTEGRITY_ERROR';
  }
}
module.exports = BookingTripIntegrityError;
