const getFrequencyUseCase = require('../../../src/modules/frequencies/application/get-frequency.use-case');
const {
  FrequencyNotFoundError,
  FrequencyError,
} = require('../../../src/modules/frequencies/domain/frequency-error');

test('obtiene la frecuencia cuando el usuario es COOPERATIVE_ADMIN', async () => {
  // Arrange
  const frequency = {
    id: 'uuid-1',
    cooperative_id: 'coop-1',
    origin: 'Ambato',
    destination: 'Quito',
  };
  const repository = { findById: jest.fn().mockResolvedValue(frequency) };
  const useCase = getFrequencyUseCase({ repository });

  // Act
  const result = await useCase('uuid-1', { role: 'COOPERATIVE_ADMIN', cooperative_id: 'coop-1' });

  // Assert
  expect(repository.findById).toHaveBeenCalledWith('coop-1', 'uuid-1');
  expect(result).toEqual(frequency);
});

test('rechaza a usuarios sin permiso', async () => {
  // Arrange
  const repository = { findById: jest.fn() };
  const useCase = getFrequencyUseCase({ repository });

  // Act / Assert
  await expect(useCase('uuid-1', { role: 'CUSTOMER' })).rejects.toBeInstanceOf(FrequencyError);
  await expect(useCase('uuid-1', { role: 'CUSTOMER' })).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
  expect(repository.findById).not.toHaveBeenCalled();
});

test('rechaza cuando falta cooperative_id', async () => {
  // Arrange
  const repository = { findById: jest.fn() };
  const useCase = getFrequencyUseCase({ repository });

  // Act / Assert
  await expect(useCase('uuid-1', { role: 'COOPERATIVE_ADMIN' })).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
  expect(repository.findById).not.toHaveBeenCalled();
});

test('propaga FrequencyNotFoundError del repositorio', async () => {
  // Arrange
  const repository = { findById: jest.fn().mockRejectedValue(new FrequencyNotFoundError()) };
  const useCase = getFrequencyUseCase({ repository });

  // Act / Assert
  await expect(
    useCase('uuid-1', { role: 'COOPERATIVE_ADMIN', cooperative_id: 'coop-1' }),
  ).rejects.toBeInstanceOf(FrequencyNotFoundError);
});
