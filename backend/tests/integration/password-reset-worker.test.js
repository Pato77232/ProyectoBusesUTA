const { createHash, randomUUID } = require('node:crypto');
const { runMigration, testPool, clearAuth } = require('../helpers/database');
const PgPasswordResetRepository = require('../../src/modules/auth/infrastructure/pg-password-reset.repository');
const createSendPasswordReset = require('../../src/modules/auth/application/send-password-reset.use-case');

const config = {
  claimMs: 120000,
  origin: 'https://pasajes.example.ec',
  tokenMinutes: 20,
  retentionDays: 1,
  actionRetentionDays: 7,
  maxAttempts: 5,
  delays: [1, 5, 15, 15],
};
let pool;
let repository;
let userId;

beforeAll(() => {
  runMigration();
  pool = testPool();
  repository = new PgPasswordResetRepository(pool);
});
beforeEach(async () => {
  await clearAuth(pool);
  userId = randomUUID();
  await pool.query(
    "INSERT INTO users(id,email,password_hash,role) VALUES($1,'client@example.ec','hash-de-prueba','CUSTOMER')",
    [userId],
  );
});
afterAll(async () => {
  if (pool) await pool.end();
});

async function request(email = 'client@example.ec') {
  await repository.request({
    email,
    ip: '127.0.0.1',
    ipMax: 10,
    emailMax: 3,
    windowMinutes: 15,
    cooldownSeconds: 60,
  });
}
function sender(mailer) {
  return createSendPasswordReset({ repository, mailer, config });
}
async function actions() {
  return (await pool.query('SELECT * FROM auth_email_actions ORDER BY requested_at,id')).rows;
}

test('emite token solo al enviar y persiste únicamente su hash con vigencia de 20 minutos', async () => {
  const mailer = { send: jest.fn().mockResolvedValue({ status: 'ACCEPTED' }) };
  await request();
  expect((await actions())[0].token_hash).toBeNull();
  expect(await sender(mailer).processNext()).toBe(true);
  const message = mailer.send.mock.calls[0][0];
  const token = message.text.match(/#token=([A-Za-z0-9_-]+)/)[1];
  expect(message.to).toBe('client@example.ec');
  expect(message.text).toContain('https://pasajes.example.ec/pages/restablecer.html#token=');
  const [action] = await actions();
  expect(action.state).toBe('ACCEPTED');
  expect(action.attempts).toBe(1);
  expect(action.token_hash).toBe(createHash('sha256').update(token).digest('hex'));
  expect(action.token_expires_at.getTime() - Date.now()).toBeGreaterThan(19 * 60000);
  expect(action.token_expires_at.getTime() - Date.now()).toBeLessThanOrEqual(20 * 60000);
  expect(JSON.stringify(action)).not.toContain(token);
  expect(await sender(mailer).processNext()).toBe(false);
});

test('resultado incierto reintenta con token nuevo e invalida el anterior', async () => {
  const failure = Object.assign(new Error('resultado incierto'), {
    code: 'MAIL_OUTCOME_UNCERTAIN',
  });
  const mailer = {
    send: jest.fn().mockRejectedValueOnce(failure).mockResolvedValue({ status: 'ACCEPTED' }),
  };
  await request();
  const worker = sender(mailer);
  await worker.processNext();
  const first = (await actions())[0];
  expect(first.state).toBe('PENDING');
  expect(first.attempts).toBe(1);
  expect(first.available_at.getTime() - Date.now()).toBeGreaterThan(50000);
  await pool.query(
    "UPDATE auth_email_actions SET available_at=CURRENT_TIMESTAMP-INTERVAL '1 second'",
  );
  await worker.processNext();
  const second = (await actions())[0];
  expect(second.state).toBe('ACCEPTED');
  expect(second.attempts).toBe(2);
  expect(second.token_hash).not.toBe(first.token_hash);
  expect(mailer.send.mock.calls[0][0].text).not.toBe(mailer.send.mock.calls[1][0].text);
});

test('rechazo permanente termina sin reintento y no conserva un token válido', async () => {
  const failure = Object.assign(new Error('rechazado'), { code: 'MAIL_PERMANENT_FAILURE' });
  const mailer = { send: jest.fn().mockRejectedValue(failure) };
  await request();
  await sender(mailer).processNext();
  expect((await actions())[0]).toMatchObject({ state: 'FAILED', token_hash: null, attempts: 1 });
  expect(await sender(mailer).processNext()).toBe(false);
});

test('cuenta eliminada no recibe enlace y la acción termina', async () => {
  const mailer = { send: jest.fn() };
  await request();
  await pool.query('DELETE FROM users WHERE id=$1', [userId]);
  await sender(mailer).processNext();
  expect((await actions())[0].state).toBe('FAILED');
  expect(mailer.send).not.toHaveBeenCalled();
});

test('una solicitud nueva sustituye un envío en curso sin reactivar el enlace anterior', async () => {
  const mailer = {
    send: jest.fn().mockImplementation(async () => {
      await pool.query(
        "UPDATE auth_password_reset_attempts SET requested_at=CURRENT_TIMESTAMP-INTERVAL '61 seconds' WHERE accepted",
      );
      await request();
      return { status: 'ACCEPTED' };
    }),
  };
  await request();
  await sender(mailer).processNext();
  const updated = await actions();
  expect(updated.map((action) => action.state).sort()).toEqual(['PENDING', 'SUPERSEDED']);
  expect(updated.find((action) => action.state === 'SUPERSEDED').token_hash).toBeNull();
});

test('SKIP LOCKED deja reclamar otra acción mientras una está bloqueada', async () => {
  await request();
  const otherId = randomUUID();
  await pool.query(
    "INSERT INTO users(id,email,password_hash,role) VALUES($1,'other@example.ec','hash-de-prueba','CUSTOMER')",
    [otherId],
  );
  await request('other@example.ec');
  const first = (await actions())[0];
  const lock = await pool.connect();
  try {
    await lock.query('BEGIN');
    await lock.query('SELECT id FROM auth_email_actions WHERE id=$1 FOR UPDATE', [first.id]);
    const claimed = await repository.claimNext({ claimMs: config.claimMs });
    expect(claimed.id).not.toBe(first.id);
  } finally {
    await lock.query('ROLLBACK');
    lock.release();
  }
});

test('el trabajador elimina contadores anteriores a la retención configurada', async () => {
  await request();
  await pool.query(
    "UPDATE auth_password_reset_attempts SET requested_at=CURRENT_TIMESTAMP-INTERVAL '2 days'",
  );
  const mailer = { send: jest.fn().mockResolvedValue({ status: 'ACCEPTED' }) };
  await sender(mailer).runBatch();
  expect(
    (await pool.query('SELECT count(*)::int AS count FROM auth_password_reset_attempts')).rows[0]
      .count,
  ).toBe(0);
});

test('el trabajador retira acciones terminadas antiguas y conserva enlaces vigentes', async () => {
  const mailer = { send: jest.fn().mockResolvedValue({ status: 'ACCEPTED' }) };
  await request();
  await sender(mailer).processNext();
  await pool.query(
    "UPDATE auth_email_actions SET requested_at=CURRENT_TIMESTAMP-INTERVAL '8 days',token_expires_at=CURRENT_TIMESTAMP-INTERVAL '1 day'",
  );
  await sender(mailer).runBatch();
  expect(await actions()).toEqual([]);
  await pool.query(
    "UPDATE auth_password_reset_attempts SET requested_at=CURRENT_TIMESTAMP-INTERVAL '61 seconds'",
  );
  await request();
  await sender(mailer).processNext();
  await pool.query(
    "UPDATE auth_email_actions SET requested_at=CURRENT_TIMESTAMP-INTERVAL '8 days'",
  );
  await sender(mailer).runBatch();
  expect((await actions())[0].state).toBe('ACCEPTED');
});
