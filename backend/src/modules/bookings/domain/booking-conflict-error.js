class BookingConflictError extends Error {
  constructor(code = 'BOOKING_SEAT_CONFLICT') {
    const messages = {
      BOOKING_ALREADY_EXISTS: 'La reserva ya existe.',
      BOOKING_SEAT_CONFLICT: 'Uno o varios asientos ya están ocupados para ese tramo.',
      BOOKING_REQUEST_KEY_REUSED: 'Esta clave ya se utilizó con otros datos de compra.',
    };
    super(messages[code]);
    this.name = 'BookingConflictError';
    this.code = code;
  }
}
module.exports = BookingConflictError;
