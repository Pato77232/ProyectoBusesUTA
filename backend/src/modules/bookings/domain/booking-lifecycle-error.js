const messages = Object.freeze({
  BOOKING_NOT_FOUND: 'No se pudo localizar la reserva para esta operación.',
  BOOKING_RECEIPT_SOURCE_MISMATCH: 'No se pudo verificar el origen del comprobante.',
  BOOKING_RECEIPT_LINK_MISMATCH: 'El comprobante no corresponde a esta operación.',
  BOOKING_DATA_INTEGRITY_ERROR: 'No se pudo verificar la integridad de la reserva.',
  BOOKING_SALE_REJECTED: 'La reserva no puede confirmarse como venta.',
  BOOKING_SALE_UNCERTAIN:
    'No se pudo confirmar el resultado de la venta; reintente con la misma identidad.',
  BOOKING_LIFECYCLE_UNAVAILABLE:
    'No se pudo confirmar la operación. Reintente con la misma identidad.',
});
class BookingLifecycleError extends Error {
  constructor(code = 'BOOKING_LIFECYCLE_UNAVAILABLE') {
    const safe = Object.hasOwn(messages, code) ? code : 'BOOKING_LIFECYCLE_UNAVAILABLE';
    super(messages[safe]);
    this.name = 'BookingLifecycleError';
    this.code = safe;
  }
}
module.exports = BookingLifecycleError;
