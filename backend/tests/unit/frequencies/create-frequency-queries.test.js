const createFrequencyQueries = require('../../../src/modules/frequencies/application/create-frequency-queries');
const {
  FrequencyNotFoundError,
} = require('../../../src/modules/frequencies/domain/frequency-error');

const row = {
  id: 'frequency-id',
  cooperative_id: 'cooperative-id',
  origin: 'Quito',
  destination: 'Ambato',
  departure_time: '08:30',
  ant_resolution_number: 'ANT-123',
  status: 'ACTIVE',
  stops: ['Latacunga'],
};

describe('frequencyQueries públicas', () => {
  let repository;
  let queries;

  beforeEach(() => {
    repository = {
      findById: jest.fn().mockResolvedValue(row),
      list: jest.fn().mockResolvedValue([row]),
    };
    queries = createFrequencyQueries({ repository });
  });

  it('consulta por id aislando por cooperativa y devuelve el resumen público', async () => {
    await expect(queries.findById(row.id, row.cooperative_id)).resolves.toEqual({
      id: row.id,
      cooperativeId: row.cooperative_id,
      origin: row.origin,
      destination: row.destination,
      departureTime: row.departure_time,
      antResolutionNumber: row.ant_resolution_number,
      status: row.status,
    });
    expect(repository.findById).toHaveBeenCalledWith(row.cooperative_id, row.id);
  });

  it('devuelve null para frecuencia inexistente o de otra cooperativa', async () => {
    repository.findById.mockRejectedValue(new FrequencyNotFoundError());
    await expect(queries.findById(row.id, row.cooperative_id)).resolves.toBeNull();
  });

  it('consulta solo frecuencias activas de la cooperativa y traduce el resumen', async () => {
    await expect(queries.findActiveByCooperativeId(row.cooperative_id)).resolves.toHaveLength(1);
    expect(repository.list).toHaveBeenCalledWith(row.cooperative_id, { status: 'ACTIVE' });
  });

  it('incluye paradas operativas al consultar el detalle', async () => {
    await expect(queries.findWithStops(row.id, row.cooperative_id)).resolves.toMatchObject({
      id: row.id,
      cooperativeId: row.cooperative_id,
      stops: ['Latacunga'],
    });
  });

  it('propaga errores técnicos', async () => {
    repository.list.mockRejectedValue(new Error('database unavailable'));
    await expect(queries.findActiveByCooperativeId(row.cooperative_id)).rejects.toThrow(
      'database unavailable',
    );
  });
});
