const { createGuestEmailAccess } = require('../../../src/modules/auth');
const { runMigration, testPool } = require('../../helpers/database');

let pool;
beforeAll(async () => {
  runMigration();
  pool = testPool();
});
afterAll(async () => pool?.end());
beforeEach(async () => {
  await pool.query('TRUNCATE auth_guest_sessions,auth_guest_verifications,auth_guest_buyers');
});

test('canje de un uso crea una sesión limitada y no guarda secretos en claro', async () => {
  const clock = () => new Date('2026-11-04T15:00:00.000Z');
  const service = createGuestEmailAccess({ pool, env: {}, clock });
  const issued = await service.issue(' Invitada@Example.EC ');
  const challenge = await pool.query('SELECT email,token_hash FROM auth_guest_verifications');
  expect(challenge.rows[0].email).toBe('invitada@example.ec');
  expect(challenge.rows[0].token_hash).not.toBe(issued.token);

  const grant = await service.redeem(issued.token);
  expect(grant.email).toBe('invitada@example.ec');
  expect(grant.expiresAt).toEqual(new Date('2026-11-04T15:30:00.000Z'));
  expect(await service.verify(grant.sessionToken)).toEqual({
    principalType: 'GUEST_BUYER',
    guestBuyerId: grant.guestBuyerId,
    email: 'invitada@example.ec',
  });
  const stored = await pool.query('SELECT session_hash FROM auth_guest_sessions');
  expect(stored.rows[0].session_hash).not.toBe(grant.sessionToken);
  await expect(service.redeem(issued.token)).rejects.toMatchObject({
    code: 'GUEST_ACCESS_INVALID',
  });
  await service.revoke(grant.sessionToken);
  await expect(service.verify(grant.sessionToken)).rejects.toMatchObject({
    code: 'GUEST_ACCESS_INVALID',
  });
});

test('canjes concurrentes solo crean una sesión y los enlaces vencidos no crean ninguna', async () => {
  let instant = new Date('2026-11-04T15:00:00.000Z');
  const service = createGuestEmailAccess({ pool, env: {}, clock: () => instant });
  const issued = await service.issue('invitado@example.ec');
  const outcomes = await Promise.allSettled([
    service.redeem(issued.token),
    service.redeem(issued.token),
  ]);
  expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
  expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
  expect((await pool.query('SELECT id FROM auth_guest_sessions')).rowCount).toBe(1);

  const expired = await service.issue('otro@example.ec');
  instant = new Date('2026-11-04T15:15:00.000Z');
  await expect(service.redeem(expired.token)).rejects.toMatchObject({
    code: 'GUEST_ACCESS_INVALID',
  });
  expect((await pool.query('SELECT id FROM auth_guest_sessions')).rowCount).toBe(1);
});

test('un nuevo enlace al correo acreditado conserva la identidad del comprador', async () => {
  const service = createGuestEmailAccess({
    pool,
    env: {},
    clock: () => new Date('2026-11-04T15:00:00.000Z'),
  });
  const first = await service.redeem((await service.issue('invitado@example.ec')).token);
  const next = await service.redeem((await service.issue(' INVITADO@example.ec ')).token);
  expect(next.guestBuyerId).toBe(first.guestBuyerId);
  expect(next.sessionToken).not.toBe(first.sessionToken);
  expect((await pool.query('SELECT id FROM auth_guest_buyers')).rowCount).toBe(1);
});
