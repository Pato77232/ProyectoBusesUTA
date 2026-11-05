const { randomUUID } = require('node:crypto');
const createIssueOwnerTickets = require('./application/issue-owner-tickets');
const createViewOwnerTickets = require('./application/view-owner-tickets');
const PgTicketRepository = require('./infrastructure/pg-ticket.repository');
const randomTicketCode = require('./infrastructure/random-ticket-code');
const createSvgQrRenderer = require('./infrastructure/svg-qr-renderer');
const createTicketRouter = require('./interfaces/ticket-router');

/**
 * API pública de Boletos. `soldBookings` es la lectura de ventas de Reservas
 * (createBookingTicketQueries), entregada por la composición del servidor. Sin `auth`
 * no se crean rutas HTTP.
 */
function createTicketsModule({
  pool,
  auth,
  soldBookings,
  clock = () => new Date(),
  qrRenderer = createSvgQrRenderer(),
} = {}) {
  const issueOwnerTickets = createIssueOwnerTickets({
    soldBookings,
    ticketRepository: new PgTicketRepository({ pool }),
    newTicketId: randomUUID,
    newTicketCode: () => randomTicketCode(),
    clock,
  });
  const viewOwnerTickets = createViewOwnerTickets({ issueOwnerTickets, qrRenderer });
  return Object.freeze({
    issueOwnerTickets,
    viewOwnerTickets,
    router: auth ? createTicketRouter({ auth, viewOwnerTickets }) : undefined,
  });
}

module.exports = { createTicketsModule };
