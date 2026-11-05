const TicketError = require('./ticket-error');
const { ticketCode, qrPayload } = require('./ticket-code');

const MAX_IDENTIFIER_LENGTH = 200;

function ownerRequest(input) {
  const valid = (value) =>
    typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_IDENTIFIER_LENGTH;
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    !valid(input.bookingId) ||
    !valid(input.ownerId)
  )
    throw new TicketError('TICKET_QUERY_INVALID');
  return Object.freeze({ bookingId: input.bookingId, ownerId: input.ownerId });
}

function issuedAt(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TicketError();
  return date.toISOString();
}

/**
 * Une la venta leída de Reservas con los boletos guardados. Exige exactamente un boleto
 * por asiento vendido, de la misma reserva y cooperativa; cualquier diferencia es un
 * error de integridad, nunca una lista parcial.
 */
function ownerTicketSheet(sale, storedTickets) {
  if (!Array.isArray(storedTickets) || storedTickets.length !== sale.passengers.length)
    throw new TicketError();
  const bySeat = new Map();
  for (const ticket of storedTickets) {
    if (
      !ticket ||
      ticket.bookingId !== sale.bookingId ||
      ticket.cooperativeId !== sale.cooperativeId ||
      bySeat.has(ticket.seatId)
    )
      throw new TicketError();
    bySeat.set(ticket.seatId, ticket);
  }
  const tickets = sale.passengers.map((passenger) => {
    const ticket = bySeat.get(passenger.seatId);
    if (!ticket || typeof ticket.id !== 'string' || !ticket.id) throw new TicketError();
    return Object.freeze({
      ticketId: ticket.id,
      code: ticketCode(ticket.code),
      qrPayload: qrPayload(ticket.code),
      issuedAt: issuedAt(ticket.issuedAt),
      seatId: passenger.seatId,
      passenger: Object.freeze({
        fullName: passenger.fullName,
        identificationNumber: passenger.identificationNumber,
      }),
      totalPriceCents: passenger.totalPriceCents,
    });
  });
  return Object.freeze({
    bookingId: sale.bookingId,
    trip: sale.trip,
    currency: sale.currency,
    totalPriceCents: sale.totalPriceCents,
    tickets: Object.freeze(tickets),
  });
}

module.exports = { ownerRequest, ownerTicketSheet };
