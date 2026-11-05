const { emailNotice } = require('../domain/email-notice');

/**
 * Outbox de avisos. `enqueueWith` usa el cliente de la transacción de quien cambia el
 * estado: si esa transacción se revierte, el aviso desaparece con ella. Un aviso por tipo
 * y reserva; repetir la operación no lo duplica.
 */
function createNotificationOutbox({ newId, clock }) {
  if (typeof newId !== 'function' || typeof clock !== 'function')
    throw new TypeError('El outbox de avisos requiere identificadores y reloj.');
  return Object.freeze({
    async enqueueWith(client, input) {
      if (typeof client?.query !== 'function')
        throw new TypeError('Se requiere el cliente de la transacción en curso.');
      const notice = emailNotice(input);
      const now = clock();
      const { rows } = await client.query(
        `INSERT INTO email_notifications
           (id, kind, booking_id, cooperative_id, payload, next_attempt_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6)
         ON CONFLICT (kind, booking_id) DO NOTHING
         RETURNING id`,
        [newId(), notice.kind, notice.bookingId, notice.cooperativeId, notice.payload, now],
      );
      return Object.freeze({ queued: rows.length === 1 });
    },
  });
}

module.exports = createNotificationOutbox;
