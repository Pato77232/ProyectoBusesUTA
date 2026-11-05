function positiveInteger(value, fallback, name) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(number) || number <= 0)
    throw new Error(`Configuración inválida: ${name}.`);
  return number;
}

function publicOrigin(value, production) {
  if (typeof value !== 'string' || !value)
    throw new Error('PUBLIC_WEB_ORIGIN es obligatorio para el trabajador de recuperación.');
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
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.href !== `${url.origin}/`
  )
    throw new Error('PUBLIC_WEB_ORIGIN debe contener solo un origen HTTPS válido.');
  return url.origin;
}

function readPasswordResetWorkerConfig(env = process.env) {
  if (
    env.PASSWORD_RESET_WORKER_ENABLED === undefined ||
    env.PASSWORD_RESET_WORKER_ENABLED === 'false'
  )
    return Object.freeze({ enabled: false });
  if (env.PASSWORD_RESET_WORKER_ENABLED !== 'true')
    throw new Error('PASSWORD_RESET_WORKER_ENABLED debe ser true o false.');
  const delays = (env.PASSWORD_RESET_RETRY_DELAYS_MINUTES || '1,5,15,15')
    .split(',')
    .map((value) => positiveInteger(value, undefined, 'PASSWORD_RESET_RETRY_DELAYS_MINUTES'));
  const maxAttempts = positiveInteger(
    env.PASSWORD_RESET_MAX_ATTEMPTS,
    5,
    'PASSWORD_RESET_MAX_ATTEMPTS',
  );
  if (delays.length !== maxAttempts - 1)
    throw new Error('PASSWORD_RESET_RETRY_DELAYS_MINUTES exige una demora por reintento.');
  return Object.freeze({
    enabled: true,
    origin: publicOrigin(env.PUBLIC_WEB_ORIGIN, env.NODE_ENV === 'production'),
    pollMs: positiveInteger(env.PASSWORD_RESET_POLL_MS, 5000, 'PASSWORD_RESET_POLL_MS'),
    claimMs: positiveInteger(env.PASSWORD_RESET_CLAIM_MS, 120000, 'PASSWORD_RESET_CLAIM_MS'),
    tokenMinutes: positiveInteger(
      env.PASSWORD_RESET_TOKEN_MINUTES,
      20,
      'PASSWORD_RESET_TOKEN_MINUTES',
    ),
    retentionDays: positiveInteger(
      env.PASSWORD_RESET_ATTEMPT_RETENTION_DAYS,
      1,
      'PASSWORD_RESET_ATTEMPT_RETENTION_DAYS',
    ),
    maxAttempts,
    delays,
  });
}

module.exports = { readPasswordResetWorkerConfig };
