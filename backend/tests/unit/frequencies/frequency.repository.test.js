const FrequencyRepository = require('../../../src/modules/frequencies/domain/frequency.repository');

test('el puerto declara las operaciones con alcance de cooperativa (RN-02)', async () => {
  // Arrange
  const repository = new FrequencyRepository();

  // Act / Assert
  for (const method of ['create', 'findById', 'list', 'updateStatus']) {
    expect(typeof repository[method]).toBe('function');
    await expect(repository[method]()).rejects.toThrow(
      `FrequencyRepository.${method} debe implementarse.`,
    );
  }
});
