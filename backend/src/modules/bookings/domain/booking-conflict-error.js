class BookingConflictError extends Error {
  constructor(code = 'BOOKING_SEAT_CONFLICT') {
    super(
      code === 'BOOKING_ALREADY_EXISTS'
        ? 'La reserva ya existe.'
        : 'Uno o varios asientos ya están ocupados para ese tramo.',
    );
    this.name = 'BookingConflictError';
    this.code = code;
  }
}
module.exports = BookingConflictError;
