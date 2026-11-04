const { randomUUID } = require('node:crypto');
const factory = require('../../../src/modules/route-sheets/application/use-cases/prepare-route-sheet-renewal.use-case');

function setup() {
  const request = {
    sourceRouteSheetId: randomUUID(),
    expectedProgrammingRevision: 1,
    expectedTariffRevision: 1,
    requestKey: randomUUID(),
  };
  const actor = { id: randomUUID(), cooperative_id: randomUUID(), role: 'COOPERATIVE_ADMIN' };
  const previous = {
    request,
    renewal: {
      routeSheetId: randomUUID(),
      createdBy: actor.id,
      createdAt: '2030-01-01T00:00:00.000Z',
    },
  };
  const session = {
    findReplay: jest.fn().mockResolvedValue(previous),
    readSnapshot: jest.fn(),
    save: jest.fn(),
  };
  const repository = { withLockedRenewal: jest.fn(async (_context, work) => work(session)) };
  const now = jest.fn(() => {
    throw new Error('el reintento no consulta el reloj');
  });
  return {
    request,
    actor,
    previous,
    session,
    repository,
    now,
    useCase: factory({ renewalRepository: repository, now }),
  };
}

test('autoriza antes de consultar una clave aunque exista', async () => {
  const f = setup();
  await expect(f.useCase(f.request, { ...f.actor, role: 'CLIENT' })).rejects.toMatchObject({
    httpStatus: 403,
  });
  expect(f.repository.withLockedRenewal).not.toHaveBeenCalled();
});

test('recupera la respuesta original antes de consultar fuente, reloj y proveedores', async () => {
  const f = setup();
  expect(await f.useCase(f.request, f.actor)).toEqual({
    renewal: f.previous.renewal,
    replayed: true,
  });
  expect(f.now).not.toHaveBeenCalled();
  expect(f.session.readSnapshot).not.toHaveBeenCalled();
  expect(f.session.save).not.toHaveBeenCalled();
});

test('reutilizar clave con otro origen produce conflicto sin escrituras', async () => {
  const f = setup();
  await expect(
    f.useCase({ ...f.request, sourceRouteSheetId: randomUUID() }, f.actor),
  ).rejects.toMatchObject({ code: 'ROUTE_RENEWAL_REQUEST_CONFLICT', httpStatus: 409 });
  expect(f.session.save).not.toHaveBeenCalled();
});

test('una lectura fallida no se transforma en ausencia de compromisos', async () => {
  const f = setup();
  f.session.findReplay.mockResolvedValue(null);
  f.session.readSnapshot.mockRejectedValue(new Error('fuente inaccesible'));
  await expect(f.useCase(f.request, f.actor)).rejects.toThrow('fuente inaccesible');
  expect(f.session.save).not.toHaveBeenCalled();
});
