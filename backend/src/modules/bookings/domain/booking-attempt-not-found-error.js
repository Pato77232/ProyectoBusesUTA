class BookingAttemptNotFoundError extends Error {
  constructor() {
    super('No hay un resultado de reserva disponible para esta sesión y referencia.');
    this.name = 'BookingAttemptNotFoundError';
    this.code = 'BOOKING_ATTEMPT_NOT_FOUND';
  }
}
module.exports = BookingAttemptNotFoundError;
