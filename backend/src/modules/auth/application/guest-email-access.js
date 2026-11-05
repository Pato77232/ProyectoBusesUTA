const { createHash, randomBytes, randomUUID } = require('node:crypto');
const GuestAccessError = require('../domain/guest-access-error');

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const EMAIL = /^[^\s<>@,;]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const hash = (token) => createHash('sha256').update(token).digest('hex');

function createGuestEmailAccess({
  repository,
  config,
  clock = () => new Date(),
  newSecret = () => randomBytes(32).toString('base64url'),
  newId = randomUUID,
}) {
  if (
    !repository ||
    !['createChallenge', 'redeemChallenge', 'findSession', 'revokeSession'].every(
      (method) => typeof repository[method] === 'function',
    ) ||
    !Number.isSafeInteger(config?.challengeTtlMs) ||
    !Number.isSafeInteger(config?.sessionTtlMs)
  )
    throw new TypeError('Faltan dependencias de acceso de invitado.');

  const now = () => {
    const value = clock();
    if (!(value instanceof Date) || !Number.isFinite(value.getTime()))
      throw new TypeError('Reloj de invitado inválido.');
    return value;
  };
  const validToken = (value) => typeof value === 'string' && TOKEN.test(value);
  return Object.freeze({
    async issue(email) {
      const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';
      if (normalized.length > 254 || !EMAIL.test(normalized)) throw new GuestAccessError();
      const token = newSecret();
      if (!validToken(token)) throw new TypeError('Generador de token inválido.');
      const expiresAt = new Date(now().getTime() + config.challengeTtlMs);
      await repository.createChallenge({ email: normalized, tokenHash: hash(token), expiresAt });
      return Object.freeze({ token, expiresAt });
    },
    async redeem(token) {
      if (!validToken(token)) throw new GuestAccessError();
      const sessionToken = newSecret();
      if (!validToken(sessionToken)) throw new TypeError('Generador de sesión inválido.');
      const at = now();
      const expiresAt = new Date(at.getTime() + config.sessionTtlMs);
      const grant = await repository.redeemChallenge({
        tokenHash: hash(token),
        sessionHash: hash(sessionToken),
        sessionId: newId(),
        guestBuyerId: newId(),
        now: at,
        expiresAt,
      });
      if (!grant) throw new GuestAccessError();
      return Object.freeze({
        sessionToken,
        guestBuyerId: grant.guestBuyerId,
        email: grant.email,
        expiresAt,
      });
    },
    async verify(sessionToken) {
      if (!validToken(sessionToken)) throw new GuestAccessError();
      const grant = await repository.findSession(hash(sessionToken));
      if (!grant || grant.revokedAt || new Date(grant.expiresAt) <= now())
        throw new GuestAccessError();
      return Object.freeze({
        principalType: 'GUEST_BUYER',
        guestBuyerId: grant.guestBuyerId,
        email: grant.email,
      });
    },
    async revoke(sessionToken) {
      if (!validToken(sessionToken)) throw new GuestAccessError();
      await repository.revokeSession(hash(sessionToken), now());
    },
  });
}

module.exports = createGuestEmailAccess;
