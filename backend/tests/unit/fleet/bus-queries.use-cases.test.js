const listBuses = require('../../../src/modules/fleet/application/list-buses.use-case');
const getBusDetails = require('../../../src/modules/fleet/application/get-bus-details.use-case');
const getBusPhoto = require('../../../src/modules/fleet/application/get-bus-photo.use-case');

const ACTOR = {
  role: 'COOPERATIVE_ADMIN',
  cooperative_id: '11111111-1111-4111-8111-111111111111',
};
const BUS_ID = '22222222-2222-4222-8222-222222222222';
const PHOTO_ID = '33333333-3333-4333-8333-333333333333';

test('lista buses del tenant autenticado y no recibe filtros de la petición', async () => {
  const buses = [{ id: BUS_ID, unitNumber: 7 }];
  const repository = { listAdminBuses: jest.fn().mockResolvedValue(buses) };
  const execute = listBuses({ repository });

  await expect(execute(ACTOR)).resolves.toBe(buses);
  expect(repository.listAdminBuses).toHaveBeenCalledWith(ACTOR.cooperative_id);
});

test.each([
  undefined,
  { role: 'CLERK', cooperative_id: ACTOR.cooperative_id },
  { role: 'COOPERATIVE_ADMIN' },
])('rechaza actor sin permiso o tenant antes de consultar', async (actor) => {
  const repository = { listAdminBuses: jest.fn() };
  const execute = listBuses({ repository });

  await expect(execute(actor)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  expect(repository.listAdminBuses).not.toHaveBeenCalled();
});

test('consulta una ficha con ID y tenant autenticado', async () => {
  const bus = { id: BUS_ID, seats: [] };
  const repository = { findAdminDetails: jest.fn().mockResolvedValue(bus) };
  const execute = getBusDetails({ repository });

  await expect(execute(BUS_ID, ACTOR)).resolves.toBe(bus);
  expect(repository.findAdminDetails).toHaveBeenCalledWith(BUS_ID, ACTOR.cooperative_id);
});

test.each(['bad-id', '44444444-4444-4444-8444-444444444444'])(
  'no revela bus inválido o ausente (%s)',
  async (busId) => {
    const repository = { findAdminDetails: jest.fn().mockResolvedValue(null) };
    const execute = getBusDetails({ repository });

    await expect(execute(busId, ACTOR)).rejects.toMatchObject({ code: 'BUS_NOT_FOUND' });
    if (busId === 'bad-id') expect(repository.findAdminDetails).not.toHaveBeenCalled();
  },
);

test('obtiene bytes solo tras verificar bus, foto y tenant en el repositorio', async () => {
  const photo = { fileKey: PHOTO_ID, contentType: 'image/png', size: 4 };
  const bytes = Buffer.from('PNG!');
  const repository = { findPhotoById: jest.fn().mockResolvedValue(photo) };
  const storage = { read: jest.fn().mockResolvedValue(bytes) };
  const execute = getBusPhoto({ repository, storage });

  await expect(execute({ busId: BUS_ID, photoId: PHOTO_ID }, ACTOR)).resolves.toEqual({
    contentType: 'image/png',
    bytes,
  });
  expect(repository.findPhotoById).toHaveBeenCalledWith({
    busId: BUS_ID,
    photoId: PHOTO_ID,
    cooperativeId: ACTOR.cooperative_id,
  });
  expect(storage.read).toHaveBeenCalledWith({ busId: BUS_ID, fileKey: PHOTO_ID, size: 4 });
});

test('no intenta leer el almacenamiento cuando la foto no pertenece al tenant', async () => {
  const repository = { findPhotoById: jest.fn().mockResolvedValue(null) };
  const storage = { read: jest.fn() };
  const execute = getBusPhoto({ repository, storage });

  await expect(execute({ busId: BUS_ID, photoId: PHOTO_ID }, ACTOR)).rejects.toMatchObject({
    code: 'BUS_PHOTO_NOT_FOUND',
  });
  expect(storage.read).not.toHaveBeenCalled();
});
