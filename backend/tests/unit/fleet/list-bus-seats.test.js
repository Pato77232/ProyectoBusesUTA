const { randomUUID } = require('node:crypto');
const listBusSeats = require('../../../src/modules/fleet/application/list-bus-seats.use-case');
const BusRepository = require('../../../src/modules/fleet/domain/bus.repository');
const PgBusRepository = require('../../../src/modules/fleet/infrastructure/pg-bus.repository');

const busId = randomUUID();
const cooperativeId = randomUUID();
const seat = {
  seatId: randomUUID(),
  layoutSeatKey: 'deck-1-0-0',
  label: 1,
  deck: 1,
  row: 0,
  column: 0,
  category: 'NORMAL',
  offered: true,
};

function useCaseReturning(inventory) {
  const repository = { listSeats: jest.fn().mockResolvedValue(inventory) };
  return { repository, listByBus: listBusSeats({ repository }) };
}

test('el puerto exige implementar la lectura de asientos', async () => {
  await expect(new BusRepository().listSeats()).rejects.toThrow('listSeats');
});

test('entrega los asientos del repositorio en el mismo orden', async () => {
  const second = { ...seat, seatId: randomUUID(), label: 2 };
  const { repository, listByBus } = useCaseReturning({ busId, seats: [seat, second] });
  await expect(listByBus({ busId, cooperativeId })).resolves.toEqual({
    busId,
    seats: [seat, second],
  });
  expect(repository.listSeats).toHaveBeenCalledWith(busId, cooperativeId);
});

test('la respuesta, la lista y cada asiento son inmutables', async () => {
  const result = await useCaseReturning({ busId, seats: [seat] }).listByBus({
    busId,
    cooperativeId,
  });
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.seats)).toBe(true);
  expect(Object.isFrozen(result.seats[0])).toBe(true);
});

test('un bus inexistente devuelve null y uno sin asientos una lista vacía', async () => {
  await expect(useCaseReturning(null).listByBus({ busId, cooperativeId })).resolves.toBeNull();
  await expect(
    useCaseReturning({ busId, seats: [] }).listByBus({ busId, cooperativeId }),
  ).resolves.toEqual({ busId, seats: [] });
});

test.each([
  ['entrada ausente', undefined],
  ['entrada nula', null],
  ['lista', [busId, cooperativeId]],
  ['bus ausente', { cooperativeId }],
  ['cooperativa ausente', { busId }],
  ['bus con formato inválido', { busId: 'bus-1', cooperativeId }],
  ['cooperativa con formato inválido', { busId, cooperativeId: 7 }],
  ['campo extra', { busId, cooperativeId, includeHidden: true }],
])('%s produce un error de validación sin consultar la base', async (_name, input) => {
  const { repository, listByBus } = useCaseReturning(null);
  await expect(listByBus(input)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(repository.listSeats).not.toHaveBeenCalled();
});

test('un fallo de la base se propaga y nunca se convierte en lista vacía', async () => {
  const failure = new Error('fallo de conexión');
  const pool = { query: jest.fn().mockRejectedValue(failure) };
  const listByBus = listBusSeats({ repository: new PgBusRepository(pool) });
  await expect(listByBus({ busId, cooperativeId })).rejects.toBe(failure);
});
