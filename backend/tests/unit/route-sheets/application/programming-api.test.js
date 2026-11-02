const { randomUUID } = require('node:crypto');
const { programmingSessionFixture } = require('../../../helpers/single-frequency-programming');
const getFactory = require('../../../../src/modules/route-sheets/application/use-cases/get-route-sheet-programming.use-case');
const guardFactory = require('../../../../src/modules/route-sheets/application/use-cases/assert-legacy-programming-operation.use-case');
const {
  validateProgrammingForPublication,
} = require('../../../../src/modules/route-sheets/application/services/validate-programming-for-publication');
const createController = require('../../../../src/modules/route-sheets/interfaces/http/route-sheet-programming.controller');
const legacyPool = require('../../../../src/modules/route-sheets/infrastructure/legacy-programming-pool');

function fixture() {
  const busId = randomUUID(),
    frequencyId = randomUUID(),
    cooperativeId = randomUUID(),
    busGroupId = randomUUID();
  const session = programmingSessionFixture({ busId, frequencyId, cooperativeId, busGroupId });
  return {
    session,
    context: { routeSheetId: randomUUID(), cooperativeId },
    input: {
      programmingSession: jest.fn(async () => session),
      busQueryPort: session.busQueryPort,
      sheet: { routeDate: '2026-11-02', bus_group_id: busGroupId },
      cooperativeId,
      expectedProgrammingRevision: 1,
      now: '2026-11-01T00:00:00Z',
      frequencyQueryPort: {
        findWithStops: jest.fn(async () => ({
          id: frequencyId,
          cooperativeId,
          origin: 'Ambato',
          destination: 'Quito',
          stops: [],
          departureTime: '07:00',
          antResolutionNumber: 'ANT-FICTICIA',
          status: 'ACTIVE',
        })),
      },
    },
  };
}

test('consulta delega contexto canónico y conserva ausencia de programación', async () => {
  const f = fixture();
  const record = { ...f.context, programming: null, revision: 0 };
  const programmingRepository = { findSnapshot: jest.fn(async () => record) };
  await expect(getFactory({ programmingRepository })(f.context)).resolves.toBe(record);
  expect(programmingRepository.findSnapshot).toHaveBeenCalledWith(f.context);
});

test('consulta valida UUID y ausencia de proveedor', async () => {
  const f = fixture();
  await expect(getFactory({})(f.context)).rejects.toMatchObject({ httpStatus: 503 });
  await expect(getFactory({})({ ...f.context, routeSheetId: 'incorrecto' })).rejects.toMatchObject({
    httpStatus: 400,
  });
});

test.each([null, { revision: 1 }])(
  'guarda contra rutas antiguas solo cuando hay programación %s',
  async (programming) => {
    const getProgramming = jest.fn(async () => ({ programming }));
    const guard = guardFactory({ getProgramming });
    const f = fixture();
    if (programming)
      await expect(guard(f.context)).rejects.toMatchObject({
        code: 'ROUTE_PROGRAMMING_LEGACY_OPERATION',
        httpStatus: 409,
      });
    else await expect(guard(f.context)).resolves.toBeUndefined();
  },
);

test('revalida fuentes y compromisos sin modificar el registro persistido', async () => {
  const f = fixture();
  const before = JSON.parse(JSON.stringify(f.session.record));
  await expect(validateProgrammingForPublication(f.input)).resolves.toBeUndefined();
  expect(f.session.findCommitments).toHaveBeenCalledTimes(1);
  expect(f.session.record).toEqual(before);
});

test.each([0, -1, '1', null, 1.5])(
  'rechaza revisión de programación inválida %s',
  async (expectedProgrammingRevision) => {
    const f = fixture();
    await expect(
      validateProgrammingForPublication({ ...f.input, expectedProgrammingRevision }),
    ).rejects.toMatchObject({ httpStatus: 400 });
    expect(f.session.busQueryPort.findById).not.toHaveBeenCalled();
  },
);

test('revisión desactualizada no valida una programación no aceptada', async () => {
  const f = fixture();
  f.session.record.revision = 2;
  await expect(validateProgrammingForPublication(f.input)).rejects.toMatchObject({
    code: 'ROUTE_PROGRAMMING_REVISION_CONFLICT',
  });
});

test.each(['missing', 'corrupt', 'route', 'bus', 'source', 'legacy', 'date'])(
  'publicación rechaza %s',
  async (scenario) => {
    const f = fixture();
    const actions = {
      missing: () => {
        f.session.record = null;
      },
      corrupt: () => {
        f.session.record.programming.agendas = null;
      },
      route: () => {
        f.session.record.programming.agendas[0].activities[0].points[0].locationKey =
          'Origen alterado';
      },
      bus: () => f.session.busQueryPort.findById.mockResolvedValue(null),
      source: () =>
        f.session.busQueryPort.findById.mockRejectedValue(new Error('Conexión ficticia')),
      legacy: () =>
        f.session.findCommitments.mockResolvedValue({ programs: [], hasLegacyConflicts: true }),
      date: () => {
        f.input.sheet.routeDate = '2026-11-03';
      },
    };
    actions[scenario]();
    const codes = {
      missing: 'ROUTE_PROGRAMMING_REQUIRED',
      corrupt: 'ROUTE_PROGRAMMING_SOURCE_UNAVAILABLE',
      route: 'ROUTE_PROGRAMMING_ROUTE_CONFLICT',
      bus: 'ROUTE_PROGRAMMING_BUS_CONFLICT',
      source: 'ROUTE_PROGRAMMING_SOURCE_UNAVAILABLE',
      legacy: 'ROUTE_PROGRAMMING_LEGACY_UNVERIFIABLE',
      date: 'ROUTE_PROGRAMMING_DATE_CONFLICT',
    };
    await expect(validateProgrammingForPublication(f.input)).rejects.toMatchObject({
      code: codes[scenario],
    });
  },
);

test('controlador toma tenant y actor de sesión y responde con revisión', async () => {
  const f = fixture();
  const saveProgramming = jest.fn(async () => ({ revision: 1 }));
  const controller = createController({ saveProgramming });
  const req = {
    params: { id: f.context.routeSheetId },
    auth: { user: { cooperative_id: f.context.cooperativeId, id: randomUUID() } },
    body: { expectedRevision: 0, programming: {} },
  };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  await controller.save(req, res, next);
  expect(saveProgramming).toHaveBeenCalledWith({
    ...f.context,
    modifiedBy: req.auth.user.id,
    ...req.body,
  });
  expect(res.json).toHaveBeenCalledWith({ revision: 1 });
  expect(next).not.toHaveBeenCalled();
});

test.each(['cooperativeId', 'modifiedBy', 'status'])(
  'controlador no acepta autoridad del body: %s',
  async (field) => {
    const saveProgramming = jest.fn();
    const next = jest.fn();
    const req = { body: { expectedRevision: 0, programming: {}, [field]: randomUUID() } };
    await createController({ saveProgramming }).save(req, {}, next);
    expect(saveProgramming).not.toHaveBeenCalled();
    expect(next.mock.calls[0][0].httpStatus).toBe(400);
  },
);

test('controlador devuelve 503 genérico ante fallo técnico de lectura', async () => {
  const f = fixture();
  const next = jest.fn();
  await createController({
    getProgramming: jest.fn().mockRejectedValue(new Error('dato privado ficticio')),
  }).get(
    {
      params: { id: f.context.routeSheetId },
      auth: { user: { cooperative_id: f.context.cooperativeId } },
    },
    {},
    next,
  );
  expect(next.mock.calls[0][0]).toMatchObject({
    httpStatus: 503,
    code: 'ROUTE_PROGRAMMING_SOURCE_UNAVAILABLE',
  });
  expect(next.mock.calls[0][0].message).not.toContain('privado');
});

test.each(['guard_route_programming_legacy_write', 'guard_route_programming_cycles'])(
  'traduce defensa SQL %s sin exponer detalles',
  async (name) => {
    const pool = {
      query: jest
        .fn()
        .mockRejectedValue({ code: '23514', where: `PL/pgSQL function ${name}() line 2` }),
    };
    await expect(legacyPool(pool).query('SQL ficticio')).rejects.toMatchObject({
      httpStatus: 409,
      code: 'ROUTE_PROGRAMMING_LEGACY_OPERATION',
    });
  },
);

test('no oculta errores SQL ajenos a la defensa de programación', async () => {
  const error = new Error('Fallo ficticio');
  error.code = '23514';
  await expect(
    legacyPool({ query: jest.fn().mockRejectedValue(error) }).query('SQL ficticio'),
  ).rejects.toBe(error);
});
