const { randomUUID } = require('node:crypto');
const createNotificationOutbox = require('./infrastructure/pg-notification-outbox');

/**
 * API pública de Avisos. Pagos y Reservas reciben `outbox` por composición y llaman
 * `enqueueWith(client, aviso)` dentro de su propia transacción.
 */
function createNotificationsModule({ clock = () => new Date(), newId = randomUUID } = {}) {
  return Object.freeze({ outbox: createNotificationOutbox({ newId, clock }) });
}

module.exports = { createNotificationsModule };
