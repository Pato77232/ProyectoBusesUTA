const createPersist = require('../../../src/modules/fleet/application/persist-bus-with-photos');

let repository, storage, session, logger, persist;
const input = {
  id: 'bus-servidor',
  cooperativeId: 'coop-servidor',
  photos: ['bytes-validados'],
  data: {},
};
beforeEach(() => {
  session = {
    operationId: 'operacion-servidor',
    references: [{ fileKey: 'clave', contentType: 'image/png', size: 1, order: 0 }],
    promote: jest.fn(),
    discard: jest.fn(),
  };
  storage = { prepare: jest.fn().mockResolvedValue(session) };
  repository = {
    create: jest.fn(async (request, { beforeCommit }) => {
      await beforeCommit();
      return { id: request.id };
    }),
  };
  logger = { error: jest.fn() };
  persist = createPersist({ repository, storage, logger });
});

test('promueve dentro de la transacción y no limpia tras confirmación positiva', async () => {
  await expect(persist(input)).resolves.toEqual({ id: input.id });
  expect(storage.prepare).toHaveBeenCalledWith({ busId: input.id, photos: input.photos });
  expect(repository.create).toHaveBeenCalledWith(
    { ...input, photos: [{ fileKey: 'clave', contentType: 'image/png', size: 1 }] },
    { beforeCommit: session.promote },
  );
  expect(session.promote).toHaveBeenCalledTimes(1);
  expect(session.discard).not.toHaveBeenCalled();
});

test.each(['BUS_ALREADY_EXISTS', 'BUS_GROUP_NOT_FOUND', 'SQL_FAILURE'])(
  'compensa archivos ante %s sin ocultar error original',
  async (code) => {
    const error = Object.assign(new Error('Error de prueba'), { code });
    repository.create.mockRejectedValue(error);
    await expect(persist(input)).rejects.toBe(error);
    expect(session.discard).toHaveBeenCalledTimes(1);
  },
);

test('fallo de promoción requiere compensación y no se presenta como éxito', async () => {
  session.promote.mockRejectedValue(new Error('Promoción fallida'));
  await expect(persist(input)).rejects.toThrow('Promoción fallida');
  expect(session.discard).toHaveBeenCalledTimes(1);
});

test('COMMIT incierto conserva fotos y registra solo identificadores internos', async () => {
  const error = Object.assign(new Error('datos privados de prueba'), {
    code: 'BUS_REGISTRATION_COMMIT_UNKNOWN',
  });
  repository.create.mockRejectedValue(error);
  await expect(persist(input)).rejects.toBe(error);
  expect(session.discard).not.toHaveBeenCalled();
  expect(logger.error).toHaveBeenCalledWith({
    busId: input.id,
    operationId: session.operationId,
    event: 'fleet.bus_photo_commit_unknown',
  });
  expect(JSON.stringify(logger.error.mock.calls)).not.toContain(error.message);
});

test('fallo de limpieza es visible como error técnico con incidente sin rutas ni contenido', async () => {
  repository.create.mockRejectedValue(new Error('SQL privado'));
  session.discard.mockRejectedValue(new Error('ruta privada'));
  await expect(persist(input)).rejects.toMatchObject({
    code: 'BUS_PHOTO_STORAGE_ERROR',
    cleanupFailed: true,
  });
  expect(logger.error).toHaveBeenCalledWith({
    busId: input.id,
    operationId: session.operationId,
    event: 'fleet.bus_photo_cleanup_failed',
  });
});

test('fallo de preparación no inicia persistencia y reporta limpieza incompleta', async () => {
  storage.prepare.mockRejectedValue(
    Object.assign(new Error('Fallo privado'), {
      cleanupFailed: true,
      operationId: 'operacion-servidor',
    }),
  );
  await expect(persist(input)).rejects.toThrow('Fallo privado');
  expect(repository.create).not.toHaveBeenCalled();
  expect(logger.error).toHaveBeenCalledTimes(1);
});

test('fallo al enviar respuesta después del alta confirmada no vuelve a limpiar fotos', async () => {
  const result = await persist(input);
  expect(() => {
    if (result) throw new Error('Cliente desconectado');
  }).toThrow('Cliente desconectado');
  expect(session.discard).not.toHaveBeenCalled();
});
