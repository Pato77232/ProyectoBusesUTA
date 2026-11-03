const MESSAGES = Object.freeze({
  UNAUTHENTICATED: 'Sesión inválida o vencida.',
  FORBIDDEN: 'Acceso no permitido.',
  BOOKING_DATA_INTEGRITY_ERROR: 'No se pudo verificar la información de la reserva.',
  BOOKING_QUERY_UNAVAILABLE: 'La consulta de reservas no está disponible temporalmente.',
  INTERNAL_ERROR: 'No se pudo consultar la reserva.',
});

class BookingPaymentQueryError extends Error {
  constructor(code = 'INTERNAL_ERROR') {
    const safeCode = Object.hasOwn(MESSAGES, code) ? code : 'INTERNAL_ERROR';
    super(MESSAGES[safeCode]);
    this.name = 'BookingPaymentQueryError';
    this.code = safeCode;
  }
}
module.exports = BookingPaymentQueryError;
