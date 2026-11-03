class BookingServiceUnavailableError extends Error {
  constructor(code = 'BOOKING_TRIP_SERVICE_UNAVAILABLE') {
    super(
      code === 'BOOKING_BENEFIT_SERVICE_UNAVAILABLE'
        ? 'No se pudo revisar la tarifa preferencial. Intenta más tarde.'
        : 'La compra de pasajes aún no está disponible. Intenta más tarde.',
    );
    this.name = 'BookingServiceUnavailableError';
    this.code = code;
  }
}
module.exports = BookingServiceUnavailableError;
