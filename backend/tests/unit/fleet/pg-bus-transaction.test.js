const { randomUUID } = require('node:crypto');
const PgBusRepository = require('../../../src/modules/fleet/infrastructure/pg-bus.repository');
const { busRequest } = require('../../helpers/fleet-bus');

const fixture = () => busRequest({ cooperativeId: randomUUID(), busGroupId: randomUUID() });

test('no abre transacción si las referencias de fotos son inválidas', async () => {
  const pool = { connect: jest.fn() };
  const request = fixture();
  request.photos = [];
  await expect(new PgBusRepository(pool).create(request)).rejects.toMatchObject({
    code: 'VALIDATION_ERROR',
  });
  expect(pool.connect).not.toHaveBeenCalled();
});

test('propaga fallo de conexión sin intentar promoción', async () => {
  const failure = new Error('Conexión de prueba fallida');
  const pool = { connect: jest.fn().mockRejectedValue(failure) };
  const promote = jest.fn();
  await expect(new PgBusRepository(pool).create(fixture(), { beforeCommit: promote })).rejects.toBe(
    failure,
  );
  expect(promote).not.toHaveBeenCalled();
});

test('descarta conexión cuando BEGIN falla, sin fingir una transacción confirmada', async () => {
  const failure = new Error('BEGIN de prueba fallido');
  const client = { query: jest.fn().mockRejectedValue(failure), release: jest.fn() };
  const pool = { connect: async () => client };
  await expect(new PgBusRepository(pool).create(fixture())).rejects.toBe(failure);
  expect(client.query).toHaveBeenCalledTimes(1);
  expect(client.query).toHaveBeenCalledWith('BEGIN');
  expect(client.release).toHaveBeenCalledWith(true);
});

test('fallo de ROLLBACK descarta conexión y conserva el error previo a COMMIT', async () => {
  const client = {
    query: jest.fn(async (sql) => {
      if (sql === 'ROLLBACK') throw new Error('Rollback de prueba fallido');
      return { rows: [] };
    }),
    release: jest.fn(),
  };
  await expect(
    new PgBusRepository({ connect: async () => client }).create(fixture()),
  ).rejects.toMatchObject({ code: 'BUS_GROUP_NOT_FOUND' });
  expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  expect(client.query).not.toHaveBeenCalledWith('COMMIT');
  expect(client.release).toHaveBeenCalledWith(true);
});
