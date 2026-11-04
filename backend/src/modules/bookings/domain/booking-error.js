class BookingValidationError extends Error {
  constructor() {
    super('Los datos de la reserva no son válidos.');
    this.name = 'BookingValidationError';
    this.code = 'BOOKING_VALIDATION_ERROR';
  }
}

module.exports = { BookingValidationError };
