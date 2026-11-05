const { randomUUID } = require('node:crypto');
const createIssueOwnerTickets = require('./application/issue-owner-tickets');
const PgTicketRepository = require('./infrastructure/pg-ticket.repository');
const randomTicketCode = require('./infrastructure/random-ticket-code');

/**
 * API pública de Boletos. `soldBookings` es la lectura de ventas de Reservas
 * (createBookingTicketQueries), entregada por la composición del servidor.
 */
function createTicketsModule({ pool, soldBookings, clock = () => new Date() } = {}) {
  return Object.freeze({
    issueOwnerTickets: createIssueOwnerTickets({
      soldBookings,
      ticketRepository: new PgTicketRepository({ pool }),
      newTicketId: randomUUID,
      newTicketCode: () => randomTicketCode(),
      clock,
    }),
  });
}

module.exports = { createTicketsModule };
