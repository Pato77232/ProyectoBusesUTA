const createBootstrap = require('../../../src/modules/auth/application/bootstrap-admin.use-case');
const parse = require('../../../src/modules/auth/interfaces/bootstrap-credentials');
const Repository = require('../../../src/modules/auth/infrastructure/pg-bootstrap.repository');
const readCredentials = require('../../../scripts/bootstrap-admin-input');
const { Readable, PassThrough } = require('node:stream');
const { setImmediate } = require('node:timers/promises');
const password = '  contraseña de prueba larga  ';
test('normaliza email y conserva contraseña antes de delegar el hash', async () => {
  const repository = { bootstrapAdmin: jest.fn().mockResolvedValue({ created: true }) };
  const hasher = { hash: jest.fn().mockResolvedValue('digest') };
  expect(
    await createBootstrap({ repository, hasher })({ email: ' A@EXAMPLE.EC ', password }),
  ).toEqual({ created: true });
  expect(hasher.hash).toHaveBeenCalledWith(password);
  expect(repository.bootstrapAdmin).toHaveBeenCalledWith({
    email: 'a@example.ec',
    passwordHash: 'digest',
  });
});
test.each([
  {},
  { email: 'bad', password },
  { email: 'a@example.ec', password: 'short' },
  { email: 'a@example.ec', password: 'a'.repeat(129) },
  { email: 'a@example.ec', password, role: 'SYSTEM_ADMIN' },
])('rechaza datos inválidos %j', (input) => {
  expect(() => parse(input)).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
});
test('valida límites Unicode y conserva espacios', () => {
  expect(parse({ email: ' A@EXAMPLE.EC ', password })).toEqual({ email: 'a@example.ec', password });
  expect(parse({ email: 'a@example.ec', password: '😀'.repeat(15) }).password).toBe(
    '😀'.repeat(15),
  );
});
test('rollback y liberación de conexión ante fallo de escritura', async () => {
  const failure = new Error('db');
  const client = {
    query: jest
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({}),
    release: jest.fn(),
  };
  await expect(
    new Repository({ connect: async () => client }).bootstrapAdmin({
      email: 'a@example.ec',
      passwordHash: 'hash',
    }),
  ).rejects.toBe(failure);
  expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
  expect(client.release).toHaveBeenCalledTimes(1);
});
test('entrada JSON preserva UTF-8 incluso con caracteres divididos entre chunks', async () => {
  const bytes = Buffer.from(JSON.stringify({ email: 'a@example.ec', password }));
  expect(
    await readCredentials(Readable.from([...bytes].map((byte) => Buffer.from([byte])))),
  ).toEqual({ email: 'a@example.ec', password });
});
test('rechaza entrada excesiva', async () => {
  await expect(readCredentials(Readable.from(['a'.repeat(4097)]))).rejects.toThrow();
});
test('terminal oculta la contraseña y permite leerla sin alterarla', async () => {
  const input = new PassThrough();
  input.isTTY = true;
  const output = new PassThrough();
  let shown = '';
  output.on('data', (chunk) => {
    shown += chunk.toString();
  });
  const result = readCredentials(input, output);
  input.write('a@example.ec\n');
  await setImmediate();
  input.write(password + '\n');
  expect(await result).toEqual({ email: 'a@example.ec', password });
  expect(shown).not.toContain(password);
  expect(shown).not.toContain('contraseña de prueba');
  input.destroy();
  output.destroy();
});
