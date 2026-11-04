const messages = Object.freeze({
  BOOKING_SALE_NOT_CONFIRMABLE: 'La reserva no admite confirmación de venta.',
  BOOKING_SALE_LINK_MISMATCH: 'La intención no corresponde a esta venta.',
  BOOKING_SALE_VERSION_MISMATCH: 'La versión no corresponde a la venta registrada.',
  BOOKING_SALE_DATA_INTEGRITY_ERROR: 'No se pudo verificar el resultado de venta.',
});

class BookingSaleError extends Error {
  constructor(code = 'BOOKING_SALE_DATA_INTEGRITY_ERROR') {
    const safe = Object.hasOwn(messages, code) ? code : 'BOOKING_SALE_DATA_INTEGRITY_ERROR';
    super(messages[safe]);
    this.name = 'BookingSaleError';
    this.code = safe;
  }
}
module.exports = BookingSaleError;
