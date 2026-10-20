const listBusGroups = require('../../../src/modules/fleet/application/list-bus-groups.use-case');
const BusGroupError = require('../../../src/modules/fleet/domain/bus-group-error');

test('devuelve solo los grupos de la cooperativa indicada', async () => {
  const groups = [{ id: '1', name: 'A' }];
  const repository = { listByCooperative: jest.fn().mockResolvedValue(groups) };
  const actor = { role: 'COOPERATIVE_ADMIN', cooperative_id: 'coop-1' };
  await expect(listBusGroups({ repository })(actor)).resolves.toEqual(groups);
  expect(repository.listByCooperative).toHaveBeenCalledWith('coop-1');
});

test('rechaza actor no autorizado o sin cooperativa', async () => {
  const repository = { listByCooperative: jest.fn() };
  for (const actor of [
    undefined,
    { role: 'CUSTOMER', cooperative_id: 'coop-1' },
    { role: 'CLERK', cooperative_id: 'coop-1' },
    { role: 'SYSTEM_ADMIN' },
    { role: 'COOPERATIVE_ADMIN' },
    { role: 'COOPERATIVE_ADMIN', cooperative_id: null },
  ]) {
    await expect(listBusGroups({ repository })(actor)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  }
  expect(repository.listByCooperative).not.toHaveBeenCalled();
});

test('propaga errores del repositorio', async () => {
  const failure = new Error('base de datos no disponible');
  const repository = { listByCooperative: jest.fn().mockRejectedValue(failure) };
  await expect(
    listBusGroups({ repository })({ role: 'COOPERATIVE_ADMIN', cooperative_id: 'coop-1' }),
  ).rejects.toBe(failure);
});
