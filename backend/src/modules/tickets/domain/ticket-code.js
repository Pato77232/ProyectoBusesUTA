const TicketError = require('./ticket-error');

// 26 caracteres base32 (RFC 4648, sin relleno) = 130 bits; los generados usan 128 aleatorios.
const CODE_PATTERN = /^[A-Z2-7]{26}$/;
const QR_PREFIX = 'TRANSVIAJE:TICKET:';

function ticketCode(value) {
  if (typeof value !== 'string' || !CODE_PATTERN.test(value)) throw new TicketError();
  return value;
}

/** Contenido del QR: solo el código opaco, sin datos personales ni identificadores internos. */
function qrPayload(code) {
  return QR_PREFIX + ticketCode(code);
}

module.exports = { ticketCode, qrPayload };
