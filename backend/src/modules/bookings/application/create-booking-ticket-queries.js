const { request, soldBookingTicket } = require('../domain/sold-booking-ticket');
const ErrorType = require('../domain/booking-ticket-error');
const TEMPORARY = new Set([
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
function createBookingTicketQueries({ reader }) {
  if (typeof reader?.findSoldCandidate !== 'function')
    throw new TypeError('Se requiere una fuente persistida de ventas.');
  return Object.freeze({
    async findSoldForTicket(input) {
      const target = request(input);
      try {
        return soldBookingTicket(await reader.findSoldCandidate(target), target);
      } catch (error) {
        if (error instanceof ErrorType) throw error;
        throw new ErrorType(
          TEMPORARY.has(error?.code)
            ? 'BOOKING_TICKET_QUERY_UNAVAILABLE'
            : 'BOOKING_TICKET_DATA_INTEGRITY_ERROR',
        );
      }
    },
  });
}
module.exports = createBookingTicketQueries;
