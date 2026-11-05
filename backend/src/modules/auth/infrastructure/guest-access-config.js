function minutes(value, fallback, name) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 1440)
    throw new Error(`Configuración inválida: ${name}.`);
  return parsed * 60 * 1000;
}

function readGuestAccessConfig(env = process.env) {
  return Object.freeze({
    challengeTtlMs: minutes(env.GUEST_CHALLENGE_MINUTES, 15, 'GUEST_CHALLENGE_MINUTES'),
    sessionTtlMs: minutes(env.GUEST_SESSION_MINUTES, 30, 'GUEST_SESSION_MINUTES'),
  });
}

module.exports = readGuestAccessConfig;
