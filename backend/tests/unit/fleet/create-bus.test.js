const { randomUUID } = require('node:crypto');
const createBus = require('../../../src/modules/fleet/application/create-bus.use-case');
const {
  createBaseSeatLayouts,
} = require('../../../src/modules/fleet/infrastructure/seat-layout-bases');
const { busRequest } = require('../../helpers/fleet-bus');

let catalog, persist, execute, actor, data;
beforeEach(() => {
  catalog = { list: jest.fn().mockResolvedValue(createBaseSeatLayouts()) };
  persist = jest.fn().mockResolvedValue({ id: 'servidor' });
  actor = { role: 'COOPERATIVE_ADMIN', cooperative_id: randomUUID() };
  data = busRequest({ cooperativeId: actor.cooperative_id, busGroupId: randomUUID() }).data;
  execute = createBus({ catalog, persist, newId: () => 'servidor' });
});

test('deriva identidad, tenant y configuración desde el servidor antes de almacenar', async () => {
  await execute({ data, photos: ['bytes-validados'] }, actor);
  expect(persist).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'servidor',
      cooperativeId: actor.cooperative_id,
      data: expect.objectContaining({ plate: 'TBM0013', unitNumber: 1 }),
      configuration: expect.objectContaining({ capacity: 42 }),
    }),
  );
});

test.each([undefined, { role: 'CLERK', cooperative_id: 'coop' }, { role: 'COOPERATIVE_ADMIN' }])(
  'rechaza actor inválido sin consultar ni escribir',
  async (invalid) => {
    await expect(execute({ data, photos: [] }, invalid)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(catalog.list).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  },
);

test.each(['unknown', 'disabled', 'extra'])('rechaza %s antes de almacenamiento', async (kind) => {
  if (kind === 'unknown') data.seatLayoutVersion = 999;
  if (kind === 'disabled')
    data.disabledSeatKeys = createBaseSeatLayouts()[0].decks.flatMap((deck) =>
      deck.elements.filter((element) => element.kind === 'SEAT').map((element) => element.key),
    );
  if (kind === 'extra') data.cooperative_id = randomUUID();
  await expect(execute({ data, photos: [] }, actor)).rejects.toMatchObject({
    code: kind === 'unknown' ? 'SEAT_LAYOUT_NOT_FOUND' : 'VALIDATION_ERROR',
  });
  expect(persist).not.toHaveBeenCalled();
});

test('avería de catálogo conserva error técnico y no finge plantilla ausente', async () => {
  const failure = new Error('Catálogo averiado');
  catalog.list.mockRejectedValue(failure);
  await expect(execute({ data, photos: [] }, actor)).rejects.toBe(failure);
  expect(persist).not.toHaveBeenCalled();
});
