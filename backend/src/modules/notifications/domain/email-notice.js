const KINDS = Object.freeze(['TICKETS_READY', 'PROOF_REJECTED', 'BOOKING_EXPIRED']);
const MAX_IDENTIFIER_LENGTH = 200;
const MAX_JUSTIFICATION_LENGTH = 1000;

class EmailNoticeError extends TypeError {
  constructor() {
    super('El aviso por correo no es válido.');
    this.name = 'EmailNoticeError';
    this.code = 'EMAIL_NOTICE_INVALID';
  }
}

const identifier = (value) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_IDENTIFIER_LENGTH;

function payloadFor(kind, input) {
  if (kind !== 'PROOF_REJECTED') {
    if (input.justification !== undefined) throw new EmailNoticeError();
    return Object.freeze({});
  }
  const justification = input.justification;
  if (
    typeof justification !== 'string' ||
    !justification.trim() ||
    justification.length > MAX_JUSTIFICATION_LENGTH
  )
    throw new EmailNoticeError();
  return Object.freeze({ justification: justification.trim() });
}

/**
 * Aviso que se encola junto al cambio de estado. Solo guarda lo que no se puede volver a
 * leer al enviar (la justificación del rechazo); destinatario y texto se resuelven después.
 */
function emailNotice(input) {
  const allowed = ['kind', 'bookingId', 'cooperativeId', 'justification'];
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !allowed.includes(key)) ||
    !KINDS.includes(input.kind) ||
    !identifier(input.bookingId) ||
    !identifier(input.cooperativeId)
  )
    throw new EmailNoticeError();
  return Object.freeze({
    kind: input.kind,
    bookingId: input.bookingId,
    cooperativeId: input.cooperativeId,
    payload: payloadFor(input.kind, input),
  });
}

module.exports = { KINDS, emailNotice, EmailNoticeError };
