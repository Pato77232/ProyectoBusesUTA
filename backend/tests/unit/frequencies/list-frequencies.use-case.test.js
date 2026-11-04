const listFrequenciesUseCase = require('../../../src/modules/frequencies/application/list-frequencies.use-case');
const {
  FrequencyError,
  FrequencyValidationError,
} = require('../../../src/modules/frequencies/domain/frequency-error');

test('lista las frecuencias de la cooperativa sin filtros', async () => {
  // Arrange
  const frequencies = [{ id: 'uuid-1' }, { id: 'uuid-2' }];
  const repository = { list: jest.fn().mockResolvedValue(frequencies) };
  const useCase = listFrequenciesUseCase({ repository });

  // Act
  const result = await useCase({}, { role: 'COOPERATIVE_ADMIN', cooperative_id: 'coop-1' });

  // Assert
  expect(repository.list).toHaveBeenCalledWith('coop-1', {});
  expect(result).toEqual(frequencies);
});

test('normaliza filtros: status, origin y destination', async () => {
  // Arrange
  const repository = { list: jest.fn().mockResolvedValue([]) };
  const useCase = listFrequenciesUseCase({ repository });

  // Act
  await useCase(
    { status: 'INACTIVE', origin: ' Ambato ', destination: ' Quito ' },
    { role: 'COOPERATIVE_ADMIN', cooperative_id: 'coop-1' },
  );

  // Assert
  expect(repository.list).toHaveBeenCalledWith('coop-1', {
    status: 'INACTIVE',
    origin: 'Ambato',
    destination: 'Quito',
  });
});

test('ignora filtros vacíos y valida status inválido', async () => {
  // Arrange
  const repository = { list: jest.fn().mockResolvedValue([]) };
  const useCase = listFrequenciesUseCase({ repository });

  // Act / Assert
  await expect(
    useCase(
      { origin: '', destination: '   ' },
      { role: 'COOPERATIVE_ADMIN', cooperative_id: 'coop-1' },
    ),
  ).resolves.toEqual([]);
  expect(repository.list).toHaveBeenCalledWith('coop-1', {});

  await expect(
    useCase({ status: 'CANCELLED' }, { role: 'COOPERATIVE_ADMIN', cooperative_id: 'coop-1' }),
  ).rejects.toBeInstanceOf(FrequencyValidationError);
});

test('rechaza filtros no textuales', async () => {
  // Arrange
  const repository = { list: jest.fn() };
  const useCase = listFrequenciesUseCase({ repository });

  // Act / Assert
  await expect(
    useCase({ origin: 123 }, { role: 'COOPERATIVE_ADMIN', cooperative_id: 'coop-1' }),
  ).rejects.toBeInstanceOf(FrequencyError);
  await expect(
    useCase({ origin: 123 }, { role: 'COOPERATIVE_ADMIN', cooperative_id: 'coop-1' }),
  ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(repository.list).not.toHaveBeenCalled();
});

test('rechaza usuarios sin permiso', async () => {
  // Arrange
  const repository = { list: jest.fn() };
  const useCase = listFrequenciesUseCase({ repository });

  // Act / Assert
  await expect(listFrequenciesUseCase({ repository })({})).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
  await expect(listFrequenciesUseCase({ repository })({}, { role: 'CLERK' })).rejects.toMatchObject(
    { code: 'FORBIDDEN' },
  );
  await expect(
    listFrequenciesUseCase({ repository })({}, { role: 'COOPERATIVE_ADMIN' }),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
