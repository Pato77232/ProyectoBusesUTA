const { randomUUID } = require('node:crypto');
const logger = require('../../shared/logger');
const createIssueOwnerTickets = require('./application/issue-owner-tickets');
const createViewOwnerTickets = require('./application/view-owner-tickets');
const PgTicketRepository = require('./infrastructure/pg-ticket.repository');
const randomTicketCode = require('./infrastructure/random-ticket-code');
const createSvgQrRenderer = require('./infrastructure/svg-qr-renderer');
const createTicketRouter = require('./interfaces/ticket-router');
const createGetGoogleWalletLink = require('./application/get-google-wallet-link');
const { readGoogleWalletConfig } = require('./infrastructure/google-wallet-config');

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
  env = process.env,
  warn = (message) => logger.warn(message),
  googleWallet = readGoogleWalletConfig(env, { warn }),
} = {}) {
  const issueOwnerTickets = createIssueOwnerTickets({
    soldBookings,
    ticketRepository: new PgTicketRepository({ pool }),
    newTicketId: randomUUID,
    newTicketCode: () => randomTicketCode(),
    clock,
  });
  const viewOwnerTickets = createViewOwnerTickets({ issueOwnerTickets, qrRenderer });
  const getGoogleWalletLink = createGetGoogleWalletLink({ issueOwnerTickets, googleWallet });
  return Object.freeze({
    issueOwnerTickets,
    viewOwnerTickets,
    getGoogleWalletLink,
    router: auth
      ? createTicketRouter({
          auth,
          viewOwnerTickets,
          getGoogleWalletLink,
          googleWalletEnabled: googleWallet.enabled === true,
        })
      : undefined,
  });
}

module.exports = { createTicketsModule };
