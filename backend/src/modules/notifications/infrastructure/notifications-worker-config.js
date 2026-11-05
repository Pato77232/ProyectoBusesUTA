function positiveInteger(value, fallback, name) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(number) || number <= 0)
    throw new Error(`Configuración inválida: ${name}.`);
  return number;
}

/** Mismas reglas que el trabajador de recuperación: solo origen, HTTPS salvo en local. */
function publicOrigin(value, production) {
  if (typeof value !== 'string' || !value)
    throw new Error('PUBLIC_WEB_ORIGIN es obligatorio para el trabajador de avisos.');
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('PUBLIC_WEB_ORIGIN debe ser un origen web válido.');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    (url.protocol !== 'https:' && (production || !local)) ||
    url.username ||
    url.password ||
    url.href !== `${url.origin}/`
  )
    throw new Error('PUBLIC_WEB_ORIGIN debe contener solo un origen HTTPS válido.');
  return url.origin;
}

function readNotificationsWorkerConfig(env = process.env) {
  const flag = env.NOTIFICATIONS_WORKER_ENABLED;
  if (flag === undefined || flag === 'false') return Object.freeze({ enabled: false });
  if (flag !== 'true') throw new Error('NOTIFICATIONS_WORKER_ENABLED debe ser true o false.');
  const maxAttempts = positiveInteger(
    env.NOTIFICATIONS_MAX_ATTEMPTS,
    5,
    'NOTIFICATIONS_MAX_ATTEMPTS',
  );
  const delays = (env.NOTIFICATIONS_RETRY_DELAYS_MINUTES || '1,5,15,60')
    .split(',')
    .map((value) => positiveInteger(value, undefined, 'NOTIFICATIONS_RETRY_DELAYS_MINUTES'));
  if (delays.length !== maxAttempts - 1)
    throw new Error('NOTIFICATIONS_RETRY_DELAYS_MINUTES exige una demora por reintento.');
  return Object.freeze({
    enabled: true,
    origin: publicOrigin(env.PUBLIC_WEB_ORIGIN, env.NODE_ENV === 'production'),
    pollMs: positiveInteger(env.NOTIFICATIONS_POLL_MS, 5000, 'NOTIFICATIONS_POLL_MS'),
    claimMs: positiveInteger(env.NOTIFICATIONS_CLAIM_MS, 120000, 'NOTIFICATIONS_CLAIM_MS'),
    batchSize: positiveInteger(env.NOTIFICATIONS_BATCH_SIZE, 10, 'NOTIFICATIONS_BATCH_SIZE'),
    maxAttempts,
    delays: Object.freeze(delays),
  });
}

module.exports = { readNotificationsWorkerConfig };
