const findActiveByRouteUseCase = require('../../../src/modules/frequencies/application/find-active-by-route.use-case');

test('devuelve lista vacía cuando faltan parámetros', async () => {
  const repository = { listAllActiveByRoute: jest.fn() };
  const useCase = findActiveByRouteUseCase({ repository });
  await expect(useCase({})).resolves.toEqual([]);
  await expect(useCase({ origin: 'Ambato' })).resolves.toEqual([]);
  await expect(useCase({ destination: 'Quito' })).resolves.toEqual([]);
  await expect(useCase({ origin: '', destination: 'Quito' })).resolves.toEqual([]);
  expect(repository.listAllActiveByRoute).not.toHaveBeenCalled();
});

test('normaliza los valores y devuelve las frecuencias activas', async () => {
  const frequency = {
    id: 'uuid-1',
    cooperative_id: 'coop-1',
    origin: 'Ambato',
    destination: 'Quito',
    departure_time: '14:00',
    ant_resolution_number: 'ANT-123',
    status: 'ACTIVE',
    stops: ['Latacunga'],
    segment_prices: [2, 3],
  };
  const repository = { listAllActiveByRoute: jest.fn().mockResolvedValue([frequency]) };
  const useCase = findActiveByRouteUseCase({ repository });
  const result = await useCase({ origin: ' Ambato ', destination: ' Quito ' });
  expect(repository.listAllActiveByRoute).toHaveBeenCalledWith('Ambato', 'Quito');
  expect(result).toEqual([
    {
      id: 'uuid-1',
      cooperative_id: 'coop-1',
      origin: 'Ambato',
      destination: 'Quito',
      departure_time: '14:00',
      stops: ['Latacunga'],
      segment_prices: [2, 3],
    },
  ]);
  expect(result[0]).not.toHaveProperty('ant_resolution_number');
});

test('devuelve lista vacía cuando origen igual a destino', async () => {
  const repository = { listAllActiveByRoute: jest.fn() };
  const useCase = findActiveByRouteUseCase({ repository });
  await expect(useCase({ origin: 'Quito', destination: 'quito' })).resolves.toEqual([]);
  expect(repository.listAllActiveByRoute).not.toHaveBeenCalled();
});

test('devuelve lista vacía cuando no hay coincidencias', async () => {
  const repository = { listAllActiveByRoute: jest.fn().mockResolvedValue([]) };
  const useCase = findActiveByRouteUseCase({ repository });
  await expect(useCase({ origin: 'Ambato', destination: 'Loja' })).resolves.toEqual([]);
  expect(repository.listAllActiveByRoute).toHaveBeenCalledWith('Ambato', 'Loja');
});
