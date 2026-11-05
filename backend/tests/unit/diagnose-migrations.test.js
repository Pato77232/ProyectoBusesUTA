const { diagnose } = require('../../scripts/diagnose-migrations');
const { activeNames } = require('../../scripts/migration-catalog');
const env = { NODE_ENV: 'test', DATABASE_URL: 'postgres://qa:private@localhost/diagnostic_test' };

function fixture() {
  const names = activeNames.slice(0, 3);
  const client = {
    connect: jest.fn(),
    end: jest.fn(),
    query: jest.fn(async (sql) => ({
      rows: sql.includes('to_regclass')
        ? [{ name: 'pgmigrations' }]
        : names.map((name) => ({ name })),
    })),
  };
  return { names, client, createClient: jest.fn(() => client), runMigration: jest.fn() };
}

test.each([
  { env: { ...env, NODE_ENV: 'production' } },
  { env: { ...env, DATABASE_URL: 'postgres://qa:private@localhost/production' } },
  { env: { ...env, DATABASE_URL: 'invalid' } },
  { direction: 'down' },
  { direction: 'down', target: 'not-active' },
  { direction: 'up', target: activeNames[0] },
  { direction: 'invalid' },
])('rechaza solicitudes no autorizadas antes de conectarse %#', async (input) => {
  const f = fixture();
  const result = await diagnose({ env, ...f, ...input });
  expect(result).toMatchObject({ ok: false, stage: 'validation', steps: [] });
  expect(f.createClient).not.toHaveBeenCalled();
  expect(f.runMigration).not.toHaveBeenCalled();
  expect(JSON.stringify(result)).not.toContain('private');
});

test('status solo consulta historial y cierra conexión', async () => {
  const f = fixture();
  expect(await diagnose({ env, ...f })).toMatchObject({ ok: true, applied: f.names, steps: [] });
  expect(f.runMigration).not.toHaveBeenCalled();
  expect(f.client.end).toHaveBeenCalledTimes(1);
});

test('identifica el down fallido, conserva pasos completados y no continúa ni expone el mensaje', async () => {
  const f = fixture();
  f.runMigration
    .mockImplementationOnce(async () => f.names.pop())
    .mockRejectedValue(
      Object.assign(new Error('SELECT secret FROM private postgres://qa:password@localhost'), {
        code: 'P0001',
        detail: 'sensitive',
      }),
    );
  let clock = 0;
  const result = await diagnose({
    env,
    ...f,
    direction: 'down',
    target: activeNames[0],
    now: () => (clock += 5),
  });
  expect(result).toMatchObject({
    ok: false,
    stage: 'down',
    error: { code: 'P0001' },
    steps: [
      { migration: activeNames[2], ok: true, durationMs: 5 },
      { migration: activeNames[1], ok: false, durationMs: 5 },
    ],
  });
  expect(f.runMigration).toHaveBeenCalledTimes(2);
  for (const value of ['SELECT', 'private', 'password', 'sensitive', 'postgres://'])
    expect(JSON.stringify(result)).not.toContain(value);
});

test('el objetivo no aplicado no revierte nada', async () => {
  const f = fixture();
  expect(
    await diagnose({ env, ...f, direction: 'down', target: activeNames.at(-1) }),
  ).toMatchObject({ ok: false, stage: 'history' });
  expect(f.runMigration).not.toHaveBeenCalled();
});

test('un historial desconocido no se divulga ni autoriza cambios', async () => {
  const f = fixture();
  f.names.push('secret-migration');
  const result = await diagnose({ env, ...f });
  expect(result.ok).toBe(false);
  expect(JSON.stringify(result)).not.toContain('secret-migration');
});

test('un fallo de cierre conserva el código original sin exponer excepciones', async () => {
  const f = fixture();
  f.client.connect.mockRejectedValue(Object.assign(new Error('private'), { code: 'ECONNREFUSED' }));
  f.client.end.mockRejectedValue(new Error('private close'));
  const result = await diagnose({ env, ...f });
  expect(result).toMatchObject({
    ok: false,
    stage: 'connection',
    error: { code: 'ECONNREFUSED' },
    closeFailed: true,
  });
  expect(JSON.stringify(result)).not.toContain('private');
});
