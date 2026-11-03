const createClerk = require('../../../src/modules/auth/application/create-clerk.use-case');

test('normaliza email, conserva espacios de contraseña y devuelve solo identidad pública', async () => {
  const hasher = { hash: jest.fn().mockResolvedValue('hash') };
  const repository = {
    createClerk: jest.fn().mockResolvedValue({
      id: 'user-id',
      email: 'clerk@example.ec',
      role: 'CLERK',
      cooperative_id: 'cooperative-id',
      password_hash: 'hash',
    }),
  };

  const result = await createClerk({ repository, hasher })({
    cooperativeId: 'cooperative-id',
    email: ' CLERK@EXAMPLE.EC ',
    password: ' contraseña con espacios ',
  });

  expect(hasher.hash).toHaveBeenCalledWith(' contraseña con espacios ');
  expect(repository.createClerk).toHaveBeenCalledWith({
    cooperativeId: 'cooperative-id',
    email: 'clerk@example.ec',
    passwordHash: 'hash',
  });
  expect(result).toEqual({
    id: 'user-id',
    email: 'clerk@example.ec',
    role: 'CLERK',
    cooperative_id: 'cooperative-id',
  });
});

test('un error de hash impide escribir', async () => {
  const repository = { createClerk: jest.fn() };
  const error = new Error('hash failed');
  await expect(
    createClerk({ repository, hasher: { hash: () => Promise.reject(error) } })({
      cooperativeId: 'cooperative-id',
      email: 'clerk@example.ec',
      password: 'contraseña ficticia larga',
    }),
  ).rejects.toBe(error);
  expect(repository.createClerk).not.toHaveBeenCalled();
});
