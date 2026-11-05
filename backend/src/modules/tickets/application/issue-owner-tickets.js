const TicketError = require('../domain/ticket-error');
const { ownerRequest, ownerTicketSheet } = require('../domain/owner-ticket-sheet');

const TEMPORARY_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  '57P01',
  '57P02',
  '57P03',
  '40001',
  '40P01',
  '53300',
]);

function saleReadError(error) {
  if (error?.code === 'BOOKING_TICKET_QUERY_INVALID')
    return new TicketError('TICKET_QUERY_INVALID');
  if (error?.code === 'BOOKING_TICKET_QUERY_UNAVAILABLE')
    return new TicketError('TICKET_UNAVAILABLE');
  return new TicketError();
}

function storageError(error) {
  if (error instanceof TicketError) return error;
  return new TicketError(TEMPORARY_CODES.has(error?.code) ? 'TICKET_UNAVAILABLE' : undefined);
}

/**
 * Devuelve los boletos de una reserva vendida a su propietario y los emite la primera vez.
 * Repetir la consulta, o consultarla a la vez, conserva un único boleto por asiento.
 */
function createIssueOwnerTickets({
  soldBookings,
  ticketRepository,
  newTicketId,
  newTicketCode,
  clock,
}) {
  if (
    typeof soldBookings?.findSoldForOwner !== 'function' ||
    typeof ticketRepository?.issueMissing !== 'function' ||
    typeof newTicketId !== 'function' ||
    typeof newTicketCode !== 'function' ||
    typeof clock !== 'function'
  )
    throw new TypeError('Faltan dependencias para emitir boletos.');

  return async function issueOwnerTickets(input) {
    const target = ownerRequest(input);
    let sale;
    try {
      sale = await soldBookings.findSoldForOwner(target);
    } catch (error) {
      throw saleReadError(error);
    }
    if (sale === null) throw new TicketError('TICKET_NOT_FOUND');
    try {
      const stored = await ticketRepository.issueMissing({
        cooperativeId: sale.cooperativeId,
        bookingId: sale.bookingId,
        issuedAt: clock(),
        tickets: sale.passengers.map(({ seatId }) => ({
          id: newTicketId(),
          seatId,
          code: newTicketCode(),
        })),
      });
      return ownerTicketSheet(sale, stored);
    } catch (error) {
      throw storageError(error);
    }
  };
}

module.exports = createIssueOwnerTickets;
