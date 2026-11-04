function integer(env, name, fallback, min, max) {
  const raw = env[name];
  if (raw !== undefined && (typeof raw !== 'string' || !/^\d+$/.test(raw)))
    throw new Error(`${name} debe ser un entero de ${min} a ${max}.`);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(`${name} debe ser un entero de ${min} a ${max}.`);
  return value;
}
module.exports = (env = {}) => {
  const raw = env.BOOKING_EXPIRATION_ENABLED;
  if (raw !== undefined && !['true', 'false'].includes(raw))
    throw new Error('BOOKING_EXPIRATION_ENABLED debe ser true o false.');
  return Object.freeze({
    enabled: raw !== 'false',
    intervalMs: integer(env, 'BOOKING_EXPIRATION_INTERVAL_MS', 5000, 100, 60000),
    batchSize: integer(env, 'BOOKING_EXPIRATION_BATCH_SIZE', 50, 1, 500),
  });
};
