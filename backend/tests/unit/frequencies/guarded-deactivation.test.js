const changeStatus = require('../../../src/modules/frequencies/application/change-frequency-status.use-case');
const actor = { role: 'COOPERATIVE_ADMIN', cooperative_id: 'cooperativa' };
const clear = {
  verifiable: true,
  hasUnfinishedCycles: false,
  hasFutureServices: false,
  hasPassengers: false,
};
let repository, useCase;
beforeEach(() => {
  repository = {
    updateStatus: jest.fn().mockResolvedValue({ status: 'ACTIVE' }),
    withDeactivation: jest.fn(async (_coop, _id, decide) => {
      await decide(clear);
      return { status: 'INACTIVE' };
    }),
  };
  useCase = changeStatus({ repository });
});
test('desactiva solo tras validar los compromisos dentro de la sesión', async () => {
  expect(await useCase('frecuencia', 'INACTIVE', actor)).toEqual({ status: 'INACTIVE' });
  expect(repository.withDeactivation).toHaveBeenCalledWith(
    'cooperativa',
    'frecuencia',
    expect.any(Function),
  );
  expect(repository.updateStatus).not.toHaveBeenCalled();
});
test.each(['hasUnfinishedCycles', 'hasFutureServices', 'hasPassengers'])(
  'bloquea el compromiso %s',
  async (flag) => {
    repository.withDeactivation.mockImplementation(async (_coop, _id, decide) =>
      decide({ ...clear, [flag]: true }),
    );
    await expect(useCase('frecuencia', 'INACTIVE', actor)).rejects.toMatchObject({
      code: 'FREQUENCY_HAS_COMMITMENTS',
    });
    expect(repository.updateStatus).not.toHaveBeenCalled();
  },
);
test.each([null, {}, { ...clear, verifiable: false }, { ...clear, hasPassengers: undefined }])(
  'fuente no verificable no permite baja: %j',
  async (value) => {
    repository.withDeactivation.mockImplementation(async (_coop, _id, decide) => decide(value));
    await expect(useCase('frecuencia', 'INACTIVE', actor)).rejects.toMatchObject({
      code: 'FREQUENCY_COMMITMENTS_UNAVAILABLE',
    });
  },
);
test('sin sesión segura no usa la escritura anterior como fallback', async () => {
  delete repository.withDeactivation;
  await expect(useCase('frecuencia', 'INACTIVE', actor)).rejects.toMatchObject({
    code: 'FREQUENCY_COMMITMENTS_UNAVAILABLE',
  });
  expect(repository.updateStatus).not.toHaveBeenCalled();
});
test('activar conserva el contrato anterior y no necesita comprobar desactivación', async () => {
  await useCase('frecuencia', 'ACTIVE', actor);
  expect(repository.updateStatus).toHaveBeenCalledWith('cooperativa', 'frecuencia', 'ACTIVE');
  expect(repository.withDeactivation).not.toHaveBeenCalled();
});
