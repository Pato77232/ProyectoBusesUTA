const { createHash } = require('node:crypto');
const createGuestEmailAccess = require('../../../src/modules/auth/application/guest-email-access');
const readGuestAccessConfig = require('../../../src/modules/auth/infrastructure/guest-access-config');

const TOKEN = 'a'.repeat(43);
const SESSION = 'b'.repeat(43);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const config = { challengeTtlMs: 15 * 60 * 1000, sessionTtlMs: 30 * 60 * 1000 };
const at = new Date('2026-11-04T15:00:00.000Z');

function fixture(overrides = {}) {
  const repository = {
    createChallenge: jest.fn(),
    redeemChallenge: jest.fn().mockResolvedValue({
      guestBuyerId: 'buyer-1',
      email: 'invitada@example.ec',
    }),
    findSession: jest.fn().mockResolvedValue({
      guestBuyerId: 'buyer-1',
      email: 'invitada@example.ec',
      expiresAt: new Date(at.getTime() + config.sessionTtlMs),
      revokedAt: null,
    }),
    revokeSession: jest.fn(),
  };
  const service = createGuestEmailAccess({
    repository,
    config,
    clock: () => at,
    newSecret: jest.fn().mockReturnValueOnce(TOKEN).mockReturnValue(SESSION),
    newId: jest.fn().mockReturnValueOnce('session-1').mockReturnValue('buyer-1'),
    ...overrides,
  });
  return { repository, service };
}

test('emite verificación de 15 minutos y solo entrega el hash al repositorio', async () => {
  const { repository, service } = fixture();
  const result = await service.issue(' Invitada@Example.EC ');
  expect(result).toEqual({ token: TOKEN, expiresAt: new Date('2026-11-04T15:15:00.000Z') });
  expect(repository.createChallenge).toHaveBeenCalledWith({
    email: 'invitada@example.ec',
    tokenHash: hash(TOKEN),
    expiresAt: result.expiresAt,
  });
  expect(JSON.stringify(repository.createChallenge.mock.calls)).not.toContain(TOKEN);
});

test('canjea el enlace por sesión de 30 minutos con identidad de invitado', async () => {
  const { repository, service } = fixture();
  const result = await service.redeem(TOKEN);
  expect(repository.redeemChallenge).toHaveBeenCalledWith({
    tokenHash: hash(TOKEN),
    sessionHash: hash(TOKEN),
    sessionId: 'session-1',
    guestBuyerId: 'buyer-1',
    now: at,
    expiresAt: new Date('2026-11-04T15:30:00.000Z'),
  });
  expect(result).toEqual({
    sessionToken: TOKEN,
    guestBuyerId: 'buyer-1',
    email: 'invitada@example.ec',
    expiresAt: new Date('2026-11-04T15:30:00.000Z'),
  });
});

test('rechaza enlace inválido y ausencia de concesión sin exponer datos', async () => {
  const { repository, service } = fixture();
  await expect(service.redeem('mal')).rejects.toMatchObject({ code: 'GUEST_ACCESS_INVALID' });
  expect(repository.redeemChallenge).not.toHaveBeenCalled();
  repository.redeemChallenge.mockResolvedValue(null);
  await expect(service.redeem(TOKEN)).rejects.toMatchObject({ code: 'GUEST_ACCESS_INVALID' });
});

test('verifica sesión vigente y rechaza expiración o revocación', async () => {
  const { repository, service } = fixture();
  await expect(service.verify(SESSION)).resolves.toEqual({
    principalType: 'GUEST_BUYER',
    guestBuyerId: 'buyer-1',
    email: 'invitada@example.ec',
  });
  repository.findSession.mockResolvedValue({
    guestBuyerId: 'buyer-1',
    email: 'invitada@example.ec',
    expiresAt: at,
    revokedAt: null,
  });
  await expect(service.verify(SESSION)).rejects.toMatchObject({ code: 'GUEST_ACCESS_INVALID' });
  await service.revoke(SESSION);
  expect(repository.revokeSession).toHaveBeenCalledWith(hash(SESSION), at);
});

test('rechaza correo inválido y configuraciones sin vigencia positiva', async () => {
  const { repository, service } = fixture();
  await expect(service.issue('no es correo')).rejects.toMatchObject({
    code: 'GUEST_ACCESS_INVALID',
  });
  expect(repository.createChallenge).not.toHaveBeenCalled();
  expect(() => readGuestAccessConfig({ GUEST_CHALLENGE_MINUTES: '0' })).toThrow();
  expect(() => readGuestAccessConfig({ GUEST_SESSION_MINUTES: 'n/a' })).toThrow();
  expect(readGuestAccessConfig({})).toEqual(config);
});
