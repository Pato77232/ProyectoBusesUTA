const { randomUUID } = require('node:crypto');
const PgBusRepository = require('../../../src/modules/fleet/infrastructure/pg-bus.repository');
const BusRepository = require('../../../src/modules/fleet/domain/bus.repository');

const row = {
  id: randomUUID(),
  cooperative_id: randomUUID(),
  bus_group_id: randomUUID(),
  plate: 'TBM2213',
  unit_number: '7',
  capacity: 42,
};
const summary = {
  id: row.id,
  cooperativeId: row.cooperative_id,
  busGroupId: row.bus_group_id,
  plate: 'TBM-2213',
  unitNumber: 7,
  capacity: 42,
};

function repositoryReturning(rows) {
  const pool = { query: jest.fn().mockResolvedValue({ rows }) };
  return { pool, repository: new PgBusRepository(pool) };
}

test('el puerto exige implementar cada lectura', async () => {
  const port = new BusRepository();
  await expect(port.findById()).rejects.toThrow('findById');
  await expect(port.listByCooperative()).rejects.toThrow('listByCooperative');
  await expect(port.listByBusGroup()).rejects.toThrow('listByBusGroup');
});

test('findById traduce la fila a un resumen sin datos privados', async () => {
  const { pool, repository } = repositoryReturning([row]);
  await expect(repository.findById(row.id, row.cooperative_id)).resolves.toEqual(summary);
  expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('cooperative_id = $2'), [
    row.id,
    row.cooperative_id,
  ]);
});

test('findById devuelve null cuando no hay fila', async () => {
  const { repository } = repositoryReturning([]);
  await expect(repository.findById(row.id, row.cooperative_id)).resolves.toBeNull();
});

test('las listas traducen cada fila y conservan el filtro de cooperativa', async () => {
  const { pool, repository } = repositoryReturning([row]);
  await expect(repository.listByCooperative(row.cooperative_id)).resolves.toEqual([summary]);
  await expect(repository.listByBusGroup(row.bus_group_id, row.cooperative_id)).resolves.toEqual([
    summary,
  ]);
  expect(pool.query).toHaveBeenNthCalledWith(1, expect.stringContaining('ORDER BY unit_number'), [
    row.cooperative_id,
  ]);
  expect(pool.query).toHaveBeenNthCalledWith(2, expect.stringContaining('ORDER BY unit_number'), [
    row.bus_group_id,
    row.cooperative_id,
  ]);
});

test.each([['no-es-uuid'], [''], [undefined], [null], [7]])(
  'identificador inválido %p no llega a PostgreSQL',
  async (invalid) => {
    const { pool, repository } = repositoryReturning([row]);
    await expect(repository.findById(invalid, row.cooperative_id)).resolves.toBeNull();
    await expect(repository.findById(row.id, invalid)).resolves.toBeNull();
    await expect(repository.listByCooperative(invalid)).resolves.toEqual([]);
    await expect(repository.listByBusGroup(invalid, row.cooperative_id)).resolves.toEqual([]);
    await expect(repository.listByBusGroup(row.bus_group_id, invalid)).resolves.toEqual([]);
    expect(pool.query).not.toHaveBeenCalled();
  },
);
