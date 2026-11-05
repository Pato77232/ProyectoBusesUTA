const createRequestPasswordReset = require('../../../src/modules/auth/application/request-password-reset.use-case');

const config = {
  resetIpMax: 10,
  resetEmailMax: 3,
  resetWindowMinutes: 15,
  resetCooldownSeconds: 60,
  resetResponseFloorMs: 300,
};

test('normaliza correo y completa el tiempo mínimo de una respuesta 202', async () => {
  let now = 1000;
  const repository = {
    request: jest.fn().mockImplementation(async () => {
      now += 27;
    }),
  };
  const pause = jest.fn();
  const request = createRequestPasswordReset({ repository, config, clock: () => now, pause });
  await request({ email: ' CLIENT@EXAMPLE.EC ', ip: '127.0.0.1' });
  expect(repository.request).toHaveBeenCalledWith({
    email: 'client@example.ec',
    ip: '127.0.0.1',
    ipMax: 10,
    emailMax: 3,
    windowMinutes: 15,
    cooldownSeconds: 60,
  });
  expect(pause).toHaveBeenCalledWith(273);
});

test('no retrasa un rechazo 429 que depende solo de IP', async () => {
  const failure = new Error('TOO_MANY_ATTEMPTS');
  const pause = jest.fn();
  const request = createRequestPasswordReset({
    repository: {
      request: async () => {
        throw failure;
      },
    },
    config,
    clock: () => 1000,
    pause,
  });
  await expect(request({ email: 'client@example.ec', ip: '127.0.0.1' })).rejects.toBe(failure);
  expect(pause).not.toHaveBeenCalled();
});
