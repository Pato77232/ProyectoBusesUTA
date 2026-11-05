const { REQUIRED_STATUS, noticeMessage } = require('../domain/notice-message');

const MINUTE_MS = 60000;
const PERMANENT_MAIL_ERRORS = new Set([
  'MAIL_PERMANENT_FAILURE',
  'MAIL_NOT_ACCEPTED',
  'MAIL_INVALID_MESSAGE',
]);
const safeCode = (code) =>
  typeof code === 'string' && /^[A-Z_]{1,64}$/.test(code) ? code : 'UNKNOWN_ERROR';

/**
 * Envía los avisos pendientes. Un fallo temporal o incierto se reintenta según la
 * configuración; uno permanente, o un aviso que ya no corresponde a la reserva, se cierra.
 * Nunca cambia la venta, el rechazo ni el vencimiento que originó el aviso.
 */
function createSendNotifications({
  repository,
  bookingContexts,
  customerContacts,
  mailer,
  config,
  clock,
}) {
  if (
    typeof repository?.claimNext !== 'function' ||
    typeof bookingContexts?.findNotificationContext !== 'function' ||
    typeof customerContacts?.findCustomerEmail !== 'function' ||
    typeof mailer?.send !== 'function' ||
    typeof clock !== 'function' ||
    !config?.origin
  )
    throw new TypeError('Faltan dependencias para enviar avisos.');

  const finish = (notice, state, code, now) =>
    repository.finish({ id: notice.id, attempts: notice.attempts, state, code, now });

  function retryOrFail(notice, code, now) {
    if (notice.attempts >= config.maxAttempts) return finish(notice, 'FAILED', code, now);
    const delay = config.delays[notice.attempts - 1] * MINUTE_MS;
    return repository.retry({
      id: notice.id,
      attempts: notice.attempts,
      code,
      nextAttemptAt: new Date(now.getTime() + delay),
    });
  }

  async function deliver(notice, now) {
    let context;
    try {
      context = await bookingContexts.findNotificationContext({
        bookingId: notice.bookingId,
        cooperativeId: notice.cooperativeId,
      });
    } catch (error) {
      if (error?.code === 'BOOKING_NOTIFICATION_QUERY_UNAVAILABLE')
        return retryOrFail(notice, 'BOOKING_UNAVAILABLE', now);
      return finish(notice, 'FAILED', 'BOOKING_INTEGRITY_ERROR', now);
    }
    if (context === null) return finish(notice, 'FAILED', 'BOOKING_NOT_FOUND', now);
    if (context.status !== REQUIRED_STATUS[notice.kind])
      return finish(notice, 'FAILED', 'NOTICE_STATE_MISMATCH', now);

    let to;
    try {
      to = await customerContacts.findCustomerEmail(context.ownerId);
    } catch {
      return retryOrFail(notice, 'CONTACT_UNAVAILABLE', now);
    }
    if (!to) return finish(notice, 'SKIPPED', 'NO_CUSTOMER_EMAIL', now);

    const message = noticeMessage({
      kind: notice.kind,
      context,
      payload: notice.payload,
      origin: config.origin,
    });
    try {
      await mailer.send({ to, ...message, notificationId: notice.id });
    } catch (error) {
      const code = safeCode(error?.code);
      if (PERMANENT_MAIL_ERRORS.has(code)) return finish(notice, 'FAILED', code, now);
      return retryOrFail(notice, code, now);
    }
    return finish(notice, 'ACCEPTED', null, now);
  }

  async function processNext() {
    const now = clock();
    const notice = await repository.claimNext({ now, claimMs: config.claimMs });
    if (!notice) return false;
    if (notice.attempts > config.maxAttempts)
      await finish(notice, 'FAILED', 'MAX_ATTEMPTS_REACHED', now);
    else await deliver(notice, now);
    return true;
  }

  async function runBatch() {
    for (let processed = 0; processed < config.batchSize; processed += 1) {
      if (!(await processNext())) return;
    }
  }

  return Object.freeze({ processNext, runBatch });
}

module.exports = createSendNotifications;
