const MESSAGES = Object.freeze({
  BOOKING_TICKET_QUERY_INVALID: [400, 'Los datos de consulta de la venta no son válidos.'],
  BOOKING_TICKET_QUERY_UNAVAILABLE: [503, 'No se pudo consultar la venta en este momento.'],
  BOOKING_TICKET_DATA_INTEGRITY_ERROR: [500, 'No se pudo verificar la venta para emitir boletos.'],
});
class BookingTicketError extends Error {
  constructor(code = 'BOOKING_TICKET_DATA_INTEGRITY_ERROR') {
    const safe = Object.hasOwn(MESSAGES, code) ? code : 'BOOKING_TICKET_DATA_INTEGRITY_ERROR';
    super(MESSAGES[safe][1]);
    this.name = 'BookingTicketError';
    this.code = safe;
    this.httpStatus = MESSAGES[safe][0];
  }
}
module.exports = BookingTicketError;
