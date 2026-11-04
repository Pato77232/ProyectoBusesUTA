function positiveInteger(value, fallback, name) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(number) || number <= 0)
    throw new Error(`Configuración inválida: ${name}.`);
  return number;
}
function readAuthConfig(env = process.env) {
  if (env.LOGIN_RATE_LIMIT_STORE && env.LOGIN_RATE_LIMIT_STORE !== 'memory')
    throw new Error('Solo se admite LOGIN_RATE_LIMIT_STORE=memory en esta versión.');
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32)
    throw new Error('JWT_SECRET requiere al menos 32 caracteres.');
  const match = /^(\d+)(s|m|h)$/.exec(env.JWT_EXPIRES_IN || '30m');
  if (!match) throw new Error('JWT_EXPIRES_IN debe incluir unidad s, m o h.');
  const ttlSeconds = Number(match[1]) * { s: 1, m: 60, h: 3600 }[match[2]];
  positiveInteger(ttlSeconds, 1800, 'JWT_EXPIRES_IN');
  return {
    secret: env.JWT_SECRET,
    ttlSeconds,
    accountMax: positiveInteger(
      env.LOGIN_MAX_ATTEMPTS_PER_ACCOUNT,
      5,
      'LOGIN_MAX_ATTEMPTS_PER_ACCOUNT',
    ),
    ipMax: positiveInteger(env.LOGIN_MAX_ATTEMPTS_PER_IP, 20, 'LOGIN_MAX_ATTEMPTS_PER_IP'),
    windowMs:
      positiveInteger(env.LOGIN_ATTEMPT_WINDOW_MINUTES, 15, 'LOGIN_ATTEMPT_WINDOW_MINUTES') * 60000,
    lockMs:
      positiveInteger(env.LOGIN_ACCOUNT_LOCK_MINUTES, 15, 'LOGIN_ACCOUNT_LOCK_MINUTES') * 60000,
  };
}
module.exports = { readAuthConfig };
