const FrequencyQueryAdapter = require('../../../../src/modules/route-sheets/infrastructure/adapters/frequency-query-adapter');

describe('FrequencyQueryAdapter', () => {
  const cooperativeId = 'coop-1';
  const frequencyId = 'frequency-1';

  function createQueries(overrides = {}) {
    return {
      findById: jest.fn().mockResolvedValue({ id: frequencyId, status: 'ACTIVE' }),
      findActiveByCooperativeId: jest.fn().mockResolvedValue([{ id: frequencyId }]),
      findWithStops: jest.fn().mockResolvedValue({ id: frequencyId, stops: ['Parada'] }),
      ...overrides,
    };
  }

  test('consulta una frecuencia por id y cooperativa mediante la API pública', async () => {
    const frequencyQueries = createQueries();
    const adapter = new FrequencyQueryAdapter({ frequencyQueries });

    await expect(adapter.findById(frequencyId, cooperativeId)).resolves.toEqual({
      id: frequencyId,
      status: 'ACTIVE',
    });
    expect(frequencyQueries.findById).toHaveBeenCalledWith(frequencyId, cooperativeId);
  });

  test('lista solo lo que la API pública informa como activo para la cooperativa', async () => {
    const frequencyQueries = createQueries();
    const adapter = new FrequencyQueryAdapter({ frequencyQueries });

    await expect(adapter.findActiveByCooperativeId(cooperativeId)).resolves.toEqual([
      { id: frequencyId },
    ]);
    expect(frequencyQueries.findActiveByCooperativeId).toHaveBeenCalledWith(cooperativeId);
  });

  test('consulta el detalle con paradas por id y cooperativa', async () => {
    const frequencyQueries = createQueries();
    const adapter = new FrequencyQueryAdapter({ frequencyQueries });

    await expect(adapter.findWithStops(frequencyId, cooperativeId)).resolves.toEqual({
      id: frequencyId,
      stops: ['Parada'],
    });
    expect(frequencyQueries.findWithStops).toHaveBeenCalledWith(frequencyId, cooperativeId);
  });

  test('propaga errores del proveedor sin convertirlos en resultados vacíos', async () => {
    const failure = new Error('Proveedor de frecuencias no disponible');
    const frequencyQueries = createQueries({
      findActiveByCooperativeId: jest.fn().mockRejectedValue(failure),
    });
    const adapter = new FrequencyQueryAdapter({ frequencyQueries });

    await expect(adapter.findActiveByCooperativeId(cooperativeId)).rejects.toBe(failure);
  });

  test('falla al componer si la API pública no implementa el contrato requerido', () => {
    expect(() => new FrequencyQueryAdapter({ frequencyQueries: {} })).toThrow(
      'frequencyQueries requiere: findActiveByCooperativeId, findById, findWithStops.',
    );
  });
});
