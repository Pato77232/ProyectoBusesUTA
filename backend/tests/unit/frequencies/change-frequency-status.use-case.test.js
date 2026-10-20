const changeFrequencyStatusUseCase = require('../../../src/modules/frequencies/application/change-frequency-status.use-case');
const {
  FrequencyError,
  FrequencyNotFoundError,
  FrequencyValidationError,
} = require('../../../src/modules/frequencies/domain/frequency-error');

test('cambia el estado de la frecuencia', async () => {
  // Arrange
  const frequency = { id: 'uuid-1', status: 'INACTIVE' };
  const repository = { updateStatus: jest.fn().mockResolvedValue(frequency) };
  const useCase = changeFrequencyStatusUseCase({ repository });

  // Act
  const result = await useCase('uuid-1', 'INACTIVE', {
    role: 'COOPERATIVE_ADMIN',
    cooperative_id: 'coop-1',
  });

  // Assert
  expect(repository.updateStatus).toHaveBeenCalledWith('coop-1', 'uuid-1', 'INACTIVE');
  expect(result).toEqual(frequency);
});

test('rechaza usuarios sin permiso', async () => {
  // Arrange
  const repository = { updateStatus: jest.fn() };
  const useCase = changeFrequencyStatusUseCase({ repository });

  // Act / Assert
  await expect(useCase('uuid-1', 'INACTIVE', { role: 'SYSTEM_ADMIN' })).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
  await expect(repository.updateStatus).not.toHaveBeenCalled();
});

test('rechaza cuando falta cooperative_id', async () => {
  // Arrange
  const repository = { updateStatus: jest.fn() };
  const useCase = changeFrequencyStatusUseCase({ repository });

  // Act / Assert
  await expect(useCase('uuid-1', 'INACTIVE', { role: 'COOPERATIVE_ADMIN' })).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
  expect(repository.updateStatus).not.toHaveBeenCalled();
});

test('valida el estado antes de actualizarlo', async () => {
  // Arrange
  const repository = { updateStatus: jest.fn() };
  const useCase = changeFrequencyStatusUseCase({ repository });

  // Act / Assert
  await expect(
    useCase('uuid-1', 'CANCELLED', { role: 'COOPERATIVE_ADMIN', cooperative_id: 'coop-1' }),
  ).rejects.toBeInstanceOf(FrequencyValidationError);
  expect(repository.updateStatus).not.toHaveBeenCalled();
});

test('propaga FrequencyNotFoundError del repositorio', async () => {
  // Arrange
  const repository = { updateStatus: jest.fn().mockRejectedValue(new FrequencyNotFoundError()) };
  const useCase = changeFrequencyStatusUseCase({ repository });

  // Act / Assert
  await expect(
    useCase('uuid-1', 'ACTIVE', { role: 'COOPERATIVE_ADMIN', cooperative_id: 'coop-1' }),
  ).rejects.toBeInstanceOf(FrequencyNotFoundError);
});
