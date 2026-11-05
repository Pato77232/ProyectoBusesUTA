const MESSAGES = Object.freeze({
  TICKET_QUERY_INVALID: [400, 'La reserva indicada no es válida.'],
  TICKET_NOT_FOUND: [404, 'No hay boletos disponibles para esta reserva.'],
  TICKET_UNAVAILABLE: [503, 'No se pudieron consultar los boletos en este momento.'],
  TICKET_INTEGRITY_ERROR: [500, 'No se pudieron emitir los boletos de esta reserva.'],
});

/** Error de Boletos con código y estado HTTP propios; los mensajes no exponen datos internos. */
class TicketError extends Error {
  constructor(code = 'TICKET_INTEGRITY_ERROR') {
    const safe = Object.hasOwn(MESSAGES, code) ? code : 'TICKET_INTEGRITY_ERROR';
    super(MESSAGES[safe][1]);
    this.name = 'TicketError';
    this.code = safe;
    this.httpStatus = MESSAGES[safe][0];
  }
}

module.exports = TicketError;
