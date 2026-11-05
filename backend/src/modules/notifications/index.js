const { randomUUID } = require('node:crypto');
const createNotificationOutbox = require('./infrastructure/pg-notification-outbox');
const PgNotificationDeliveryRepository = require('./infrastructure/pg-notification-delivery.repository');
const createSendNotifications = require('./application/send-notifications');
const startNotificationWorker = require('./infrastructure/notification-worker');
const { readNotificationsWorkerConfig } = require('./infrastructure/notifications-worker-config');
const { createSmtpMailer } = require('../../shared/mail/smtp-mailer');

/**
 * API pública de Avisos. Pagos y Reservas reciben `outbox` por composición y llaman
 * `enqueueWith(client, aviso)` dentro de su propia transacción. El trabajador está apagado
 * salvo NOTIFICATIONS_WORKER_ENABLED=true, que exige SMTP y PUBLIC_WEB_ORIGIN válidos.
 */
function createNotificationsModule({
  pool,
  env = {},
  bookingContexts,
  customerContacts,
  mailer,
  clock = () => new Date(),
  newId = randomUUID,
} = {}) {
  const config = readNotificationsWorkerConfig(env);
  const workerMailer = config.enabled ? mailer || createSmtpMailer(env) : null;
  if (config.enabled && !workerMailer.configured)
    throw new Error('El trabajador de avisos requiere SMTP configurado.');
  return Object.freeze({
    outbox: createNotificationOutbox({ newId, clock }),
    maintenance: Object.freeze({
      startWorker({ onFailure = () => {} } = {}) {
        if (!config.enabled) return null;
        const sender = createSendNotifications({
          repository: new PgNotificationDeliveryRepository({ pool }),
          bookingContexts,
          customerContacts,
          mailer: workerMailer,
          config,
          clock,
        });
        return startNotificationWorker({
          runBatch: sender.runBatch,
          intervalMs: config.pollMs,
          onFailure,
        });
      },
    }),
  });
}

module.exports = { createNotificationsModule };
