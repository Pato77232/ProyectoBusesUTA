const createBusGroup = require('../../../src/modules/fleet/application/create-bus-group.use-case');
const BusGroupError = require('../../../src/modules/fleet/domain/bus-group-error');

const valid = { name: 'Rutas largas', category: 'LONG_ROUTE' };

test('caso de uso persiste datos normalizados para COOPERATIVE_ADMIN', async () => {
  const repository = { create: jest.fn().mockResolvedValue({ id: 'generated' }) };
  const actor = { role: 'COOPERATIVE_ADMIN', cooperative_id: 'coop-1' };
  await expect(createBusGroup({ repository })(valid, actor)).resolves.toEqual({ id: 'generated' });
  expect(repository.create).toHaveBeenCalledWith('coop-1', {
    name: 'Rutas largas',
    category: 'LONG_ROUTE',
  });
});

test.each([
  undefined,
  { role: 'CUSTOMER' },
  { role: 'CLERK' },
  { role: 'SYSTEM_ADMIN' },
  { role: 'COOPERATIVE_ADMIN' },
  { role: 'COOPERATIVE_ADMIN', cooperative_id: null },
])('rechaza actor no autorizado o sin cooperativa: %j', async (actor) => {
  const repository = { create: jest.fn() };
  await expect(createBusGroup({ repository })(valid, actor)).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
  expect(repository.create).not.toHaveBeenCalled();
});

test('validación de entrada lanza VALIDATION_ERROR y no llama al repositorio', async () => {
  const repository = { create: jest.fn() };
  const actor = { role: 'COOPERATIVE_ADMIN', cooperative_id: 'coop-1' };
  for (const input of [
    null,
    [],
    {},
    { ...valid, name: ' ' },
    { ...valid, category: 'OTRA' },
    { ...valid, extra: 'x' },
    { name: 'Grupo' },
    { category: 'LONG_ROUTE' },
  ]) {
    await expect(createBusGroup({ repository })(input, actor)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  }
  expect(repository.create).not.toHaveBeenCalled();
});

test('rechaza input que intenta aportar cooperative_id', async () => {
  const repository = { create: jest.fn() };
  const actor = { role: 'COOPERATIVE_ADMIN', cooperative_id: 'coop-1' };
  for (const input of [
    { ...valid, cooperative_id: 'otra-coop' },
    { ...valid, cooperativeId: 'otra-coop' },
  ]) {
    await expect(createBusGroup({ repository })(input, actor)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  }
  expect(repository.create).not.toHaveBeenCalled();
});

test('propaga errores del repositorio', async () => {
  const failure = new Error('base de datos no disponible');
  const repository = { create: jest.fn().mockRejectedValue(failure) };
  await expect(
    createBusGroup({ repository })(valid, { role: 'COOPERATIVE_ADMIN', cooperative_id: 'coop-1' }),
  ).rejects.toBe(failure);
});
