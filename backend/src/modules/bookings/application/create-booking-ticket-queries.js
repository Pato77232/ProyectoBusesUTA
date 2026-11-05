const {
  request,
  ownerRequest,
  soldBookingTicket,
  soldBookingTicketForOwner,
} = require('../domain/sold-booking-ticket');
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
async function classified(read) {
  try {
    return await read();
  } catch (error) {
    if (error instanceof ErrorType) throw error;
    throw new ErrorType(
      TEMPORARY.has(error?.code)
        ? 'BOOKING_TICKET_QUERY_UNAVAILABLE'
        : 'BOOKING_TICKET_DATA_INTEGRITY_ERROR',
    );
  }
}
function createBookingTicketQueries({ reader }) {
  if (
    typeof reader?.findSoldCandidate !== 'function' ||
    typeof reader?.findSoldCandidateForOwner !== 'function'
  )
    throw new TypeError('Se requiere una fuente persistida de ventas.');
  return Object.freeze({
    async findSoldForTicket(input) {
      const target = request(input);
      return classified(async () =>
        soldBookingTicket(await reader.findSoldCandidate(target), target),
      );
    },
    async findSoldForOwner(input) {
      const target = ownerRequest(input);
      return classified(async () =>
        soldBookingTicketForOwner(await reader.findSoldCandidateForOwner(target), target),
      );
    },
  });
}
module.exports = createBookingTicketQueries;
