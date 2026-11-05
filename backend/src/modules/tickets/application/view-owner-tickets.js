const TicketError = require('../domain/ticket-error');

const SVG_START = /^<svg[\s>]/;

/**
 * Presenta los boletos del propietario con su QR en SVG. El QR codifica solo `qrPayload`;
 * si no se puede dibujar, la respuesta falla completa en lugar de entregar boletos sin código.
 */
function createViewOwnerTickets({ issueOwnerTickets, qrRenderer }) {
  if (typeof issueOwnerTickets !== 'function' || typeof qrRenderer?.render !== 'function')
    throw new TypeError('Faltan dependencias para mostrar boletos.');

  async function withQr(ticket) {
    let qrSvg;
    try {
      qrSvg = await qrRenderer.render(ticket.qrPayload);
    } catch {
      throw new TicketError();
    }
    if (typeof qrSvg !== 'string' || !SVG_START.test(qrSvg)) throw new TicketError();
    return Object.freeze({ ...ticket, qrSvg });
  }

  return async function viewOwnerTickets(input) {
    const sheet = await issueOwnerTickets(input);
    const tickets = await Promise.all(sheet.tickets.map(withQr));
    return Object.freeze({ ...sheet, tickets: Object.freeze(tickets) });
  };
}

module.exports = createViewOwnerTickets;
