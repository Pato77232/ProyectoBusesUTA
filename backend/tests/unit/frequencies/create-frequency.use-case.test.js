const createFrequencyUseCase = require('../../../src/modules/frequencies/application/create-frequency.use-case');
const { createFrequency } = require('../../../src/modules/frequencies/domain/frequency');
const {
  FrequencyRequiresAntResolutionError,
  FrequencySegmentPricesMismatchError,
  FrequencyAlreadyExistsError,
  FrequencyValidationError,
  FrequencyError,
} = require('../../../src/modules/frequencies/domain/frequency-error');

const valid = {
  origin: 'Ambato',
  destination: 'Quito',
  departure_time: '14:00',
  ant_resolution_number: 'ANT-2026-000123',
  segment_prices: [8.5],
};

test('crea la frecuencia cuando el usuario es COOPERATIVE_ADMIN de la cooperativa', async () => {
  // Arrange
  const frequency = createFrequency(valid);
  const repository = {
    create: jest.fn().mockResolvedValue({ id: 'uuid-123', ...frequency }),
  };
  const useCase = createFrequencyUseCase({ repository });

  // Act
  const result = await useCase(valid, { role: 'COOPERATIVE_ADMIN', cooperative_id: 'coop-1' });

  // Assert
  expect(repository.create).toHaveBeenCalledTimes(1);
  expect(repository.create).toHaveBeenCalledWith('coop-1', frequency);
  expect(result).toEqual({ id: 'uuid-123', ...frequency });
});

test('rechaza a usuarios sin rol COOPERATIVE_ADMIN', async () => {
  // Arrange
  const repository = { create: jest.fn() };
  const useCase = createFrequencyUseCase({ repository });

  // Act / Assert
  await expect(useCase(valid, { role: 'CUSTOMER' })).rejects.toBeInstanceOf(FrequencyError);
  await expect(useCase(valid, { role: 'CUSTOMER' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  expect(repository.create).not.toHaveBeenCalled();
});

test('rechaza cuando el actor no tiene cooperative_id', async () => {
  // Arrange
  const repository = { create: jest.fn() };
  const useCase = createFrequencyUseCase({ repository });

  // Act / Assert
  await expect(useCase(valid, { role: 'COOPERATIVE_ADMIN' })).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
  expect(repository.create).not.toHaveBeenCalled();
});

test('propaga FrequencyRequiresAntResolutionError del dominio', async () => {
  // Arrange
  const input = { ...valid, ant_resolution_number: '' };
  const repository = { create: jest.fn() };
  const useCase = createFrequencyUseCase({ repository });

  // Act / Assert
  await expect(
    useCase(input, { role: 'COOPERATIVE_ADMIN', cooperative_id: 'coop-1' }),
  ).rejects.toBeInstanceOf(FrequencyRequiresAntResolutionError);
  expect(repository.create).not.toHaveBeenCalled();
});

test('propaga FrequencySegmentPricesMismatchError del dominio', async () => {
  // Arrange
  const input = { ...valid, segment_prices: [] };
  const repository = { create: jest.fn() };
  const useCase = createFrequencyUseCase({ repository });

  // Act / Assert
  await expect(
    useCase(input, { role: 'COOPERATIVE_ADMIN', cooperative_id: 'coop-1' }),
  ).rejects.toBeInstanceOf(FrequencySegmentPricesMismatchError);
  expect(repository.create).not.toHaveBeenCalled();
});

test('propaga FrequencyValidationError del dominio', async () => {
  // Arrange
  const input = { ...valid, origin: 'Quito', destination: 'Quito' };
  const repository = { create: jest.fn() };
  const useCase = createFrequencyUseCase({ repository });

  // Act / Assert
  await expect(
    useCase(input, { role: 'COOPERATIVE_ADMIN', cooperative_id: 'coop-1' }),
  ).rejects.toBeInstanceOf(FrequencyValidationError);
  expect(repository.create).not.toHaveBeenCalled();
});

test('propaga FrequencyAlreadyExistsError del repositorio', async () => {
  // Arrange
  const repository = { create: jest.fn().mockRejectedValue(new FrequencyAlreadyExistsError()) };
  const useCase = createFrequencyUseCase({ repository });

  // Act / Assert
  await expect(
    useCase(valid, { role: 'COOPERATIVE_ADMIN', cooperative_id: 'coop-1' }),
  ).rejects.toBeInstanceOf(FrequencyAlreadyExistsError);
});
