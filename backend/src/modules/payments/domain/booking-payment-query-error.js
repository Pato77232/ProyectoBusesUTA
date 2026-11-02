const ERROR_DEFINITIONS = Object.freeze({
  UNAUTHENTICATED: [401, 'Se requiere una sesión válida.'],
  FORBIDDEN: [403, 'No tiene permiso para consultar esta reserva.'],
  BOOKING_VALIDATION_ERROR: [400, 'Los datos de consulta de la reserva no son válidos.'],
  BOOKING_DATA_INTEGRITY_ERROR: [500, 'No se pudieron verificar los datos de la reserva.'],
  BOOKING_QUERY_UNAVAILABLE: [503, 'La consulta de reservas no está disponible temporalmente.'],
  INTERNAL_ERROR: [500, 'Error interno del servidor.'],
});

/** Error seguro del consumidor; no depende de clases internas del proveedor. */
class BookingPaymentQueryError extends Error {
  constructor(code) {
    const safeCode =
      typeof code === 'string' && Object.hasOwn(ERROR_DEFINITIONS, code) ? code : 'INTERNAL_ERROR';
    const [httpStatus, message] = ERROR_DEFINITIONS[safeCode];
    super(message);
    this.name = 'BookingPaymentQueryError';
    this.code = safeCode;
    this.httpStatus = httpStatus;
  }
}

module.exports = BookingPaymentQueryError;
