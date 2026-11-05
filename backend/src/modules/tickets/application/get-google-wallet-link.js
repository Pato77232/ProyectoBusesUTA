const TicketError = require('../domain/ticket-error');
const { googleWalletTransitObject } = require('../domain/google-wallet-pass');

const MAX_IDENTIFIER_LENGTH = 200;

/**
 * Devuelve el enlace «Guardar en Google Wallet» de un boleto del propietario (BOLETOS-03).
 * Reutiliza la consulta de BOLETOS-01, así que el dueño, la venta aprobada y la
 * cooperativa se comprueban igual; sin configuración no se consulta ni se firma nada.
 */
function createGetGoogleWalletLink({ issueOwnerTickets, googleWallet }) {
  if (
    typeof issueOwnerTickets !== 'function' ||
    typeof googleWallet?.signer?.saveUrl !== 'function'
  )
    throw new TypeError('Faltan dependencias para el enlace de Google Wallet.');

  return async function getGoogleWalletLink({ bookingId, ticketId, ownerId }) {
    if (!googleWallet.enabled) throw new TicketError('GOOGLE_WALLET_DISABLED');
    if (typeof ticketId !== 'string' || !ticketId.trim() || ticketId.length > MAX_IDENTIFIER_LENGTH)
      throw new TicketError('TICKET_QUERY_INVALID');
    const sheet = await issueOwnerTickets({ bookingId, ownerId });
    const ticket = sheet.tickets.find((item) => item.ticketId === ticketId);
    if (!ticket) throw new TicketError('TICKET_NOT_FOUND');
    const transitObject = googleWalletTransitObject({
      issuerId: googleWallet.issuerId,
      classSuffix: googleWallet.classSuffix,
      sheet,
      ticket,
    });
    return Object.freeze({ saveUrl: googleWallet.signer.saveUrl(transitObject) });
  };
}

module.exports = createGetGoogleWalletLink;
