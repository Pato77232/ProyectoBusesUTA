const { randomUUID } = require('node:crypto');
const fixture = require('../../../helpers/route-programming');
const saveFactory = require('../../../../src/modules/route-sheets/application/use-cases/save-route-sheet-programming.use-case');
const {
  ProgrammingNotFoundError,
} = require('../../../../src/modules/route-sheets/domain/errors/programming-persistence-errors');

function setup() {
  const f = fixture();
  const frequencyQueryPort = {
    findWithStops: jest.fn(async (id) => f.frequencies.find((v) => v.id === id)),
  };
  const busQueryPort = {
    findById: jest.fn(async () => ({
      id: f.busId,
      cooperativeId: f.cooperativeId,
      busGroupId: f.busGroupId,
    })),
  };
  const session = {
    sheet: {
      status: 'DRAFT',
      busGroupId: f.busGroupId,
      routeDate: f.body.programming.cycleStartDate,
    },
    revision: 0,
    frequencyQueryPort,
    findCommitments: jest.fn(async () => ({
      programs: [],
      hasLegacyConflicts: false,
      hasLegacyCycles: false,
    })),
    findIdentities: jest.fn(async () => ({ known: [], hasLegacyIds: false })),
    save: jest.fn(async (value) => ({ revision: 1, programming: value })),
  };
  const programmingRepository = {
    withLockedProgramming: jest.fn(async (_context, operation) => operation(session)),
  };
  return {
    ...f,
    session,
    programmingRepository,
    frequencyQueryPort,
    busQueryPort,
    save: saveFactory({ programmingRepository, busQueryPort, now: () => '2026-11-01T00:00:00Z' }),
  };
}

test('guarda tres frecuencias sucesivas con un bus, contexto y lugares autorizados', async () => {
  const f = setup();
  const before = JSON.parse(JSON.stringify(f.body));
  const result = await f.save({ ...f.context, ...f.body });
  expect(result.revision).toBe(1);
  expect(result.programming.agendas[0].activities).toHaveLength(3);
  expect(result.programming.agendas[0].activities[0]).toMatchObject({
    originKey: 'Ambato',
    destinationKey: 'Latacunga',
    departureAt: '2026-11-02T12:00:00.000Z',
  });
  expect(f.programmingRepository.withLockedProgramming).toHaveBeenCalledWith(
    f.context,
    expect.any(Function),
  );
  expect(f.session.save).toHaveBeenCalledTimes(1);
  expect(f.body).toEqual(before);
});

test.each(['cooperativeId', 'modifiedBy', 'routeSheetId'])(
  'rechaza contexto inválido %s antes de consultar',
  async (field) => {
    const f = setup();
    await expect(f.save({ ...f.context, ...f.body, [field]: 'incorrecto' })).rejects.toMatchObject({
      code: 'ROUTE_PROGRAMMING_INVALID',
    });
    expect(f.programmingRepository.withLockedProgramming).not.toHaveBeenCalled();
  },
);

test.each([-1, 1.1, '0', null, 2147483647])('rechaza revisión inválida %s', async (revision) => {
  const f = setup();
  await expect(
    f.save({ ...f.context, ...f.body, expectedRevision: revision }),
  ).rejects.toMatchObject({ code: 'ROUTE_PROGRAMMING_INVALID' });
});

test('revisión desactualizada no consulta proveedores ni escribe', async () => {
  const f = setup();
  f.session.revision = 1;
  await expect(f.save({ ...f.context, ...f.body })).rejects.toMatchObject({
    code: 'ROUTE_PROGRAMMING_REVISION_CONFLICT',
  });
  expect(f.busQueryPort.findById).not.toHaveBeenCalled();
  expect(f.session.save).not.toHaveBeenCalled();
});

test.each(['PUBLISHED', 'CANCELLED'])('no edita hoja %s', async (status) => {
  const f = setup();
  f.session.sheet.status = status;
  await expect(f.save({ ...f.context, ...f.body })).rejects.toMatchObject({
    code: 'ROUTE_PROGRAMMING_NOT_EDITABLE',
  });
  expect(f.session.save).not.toHaveBeenCalled();
});

test('propaga ausencia de hoja y fallo técnico sin guardar', async () => {
  const f = setup();
  for (const error of [new ProgrammingNotFoundError(), new Error('Fuente ficticia')]) {
    f.programmingRepository.withLockedProgramming.mockRejectedValueOnce(error);
    await expect(f.save({ ...f.context, ...f.body })).rejects.toBe(error);
  }
  expect(f.session.save).not.toHaveBeenCalled();
});

test.each([
  'fecha',
  'bus',
  'frecuencia',
  'inactiva',
  'resolucion',
  'hora',
  'puntos',
  'cobertura',
  'margen',
  'identidad',
  'campo',
  'preparacion',
  'periodo',
  'cierre',
])('rechaza programación inválida: %s', async (scenario) => {
  const f = setup();
  const p = f.body.programming;
  const agenda = p.agendas[0];
  const a = agenda.activities[0];
  const mutations = {
    fecha: () => {
      f.session.sheet.routeDate = '2026-11-03';
    },
    bus: () => f.busQueryPort.findById.mockResolvedValue(null),
    frecuencia: () => f.frequencyQueryPort.findWithStops.mockResolvedValue(null),
    inactiva: () => {
      f.frequencies[0].status = 'INACTIVE';
    },
    resolucion: () => {
      f.frequencies[0].antResolutionNumber = '';
    },
    hora: () => {
      f.frequencies[0].departureTime = '06:00';
    },
    puntos: () => {
      a.points[0].departureAt = '2026-11-02T06:00:00-05:00';
    },
    cobertura: () => {
      agenda.activities.pop();
    },
    margen: () => {
      a.preparationMinutes = 16;
    },
    identidad: () => {
      a.id = a.requiredServiceId;
    },
    campo: () => {
      agenda.cooperativeId = f.cooperativeId;
    },
    preparacion: () => {
      delete a.preparationMinutes;
    },
    periodo: () => {
      p.cycleLengthDays = 0;
    },
    cierre: () => {
      agenda.activities.pop();
      p.requiredServices.pop();
    },
  };
  mutations[scenario]();
  await expect(f.save({ ...f.context, ...f.body })).rejects.toBeInstanceOf(Error);
  expect(f.session.save).not.toHaveBeenCalled();
});

test('acepta puntos intermedios explícitos y rechaza tiempos invertidos', async () => {
  const f = setup();
  const a = f.body.programming.agendas[0].activities[0];
  f.frequencies[0].stops = ['Parada'];
  a.points.splice(1, 0, {
    position: 1,
    arrivalAt: '2026-11-02T07:20:00-05:00',
    departureAt: '2026-11-02T07:25:00-05:00',
  });
  a.points[2].position = 2;
  const result = await f.save({ ...f.context, ...f.body });
  expect(result.programming.agendas[0].activities[0].points[1].locationKey).toBe('Parada');
  a.points[1].departureAt = '2026-11-02T07:19:00-05:00';
  await expect(f.save({ ...f.context, ...f.body })).rejects.toMatchObject({
    code: 'ROUTE_PROGRAMMING_POINTS_CONFLICT',
  });
});

test('la salida autorizada no admite fracciones ocultas de segundo', async () => {
  const f = setup();
  const p = f.body.programming;
  const activity = p.agendas[0].activities[0];
  activity.departureAt = '2026-11-02T07:00:00.500-05:00';
  activity.points[0].departureAt = activity.departureAt;
  p.requiredServices[0].departureAt = activity.departureAt;
  await expect(f.save({ ...f.context, ...f.body })).rejects.toMatchObject({
    code: 'ROUTE_PROGRAMMING_DEPARTURE_CONFLICT',
  });
  expect(f.session.save).not.toHaveBeenCalled();
});

test.each(['legacy', 'cycles', 'identity', 'source'])(
  'no escribe ante fallo de %s',
  async (scenario) => {
    const f = setup();
    if (scenario === 'legacy')
      f.session.findCommitments.mockResolvedValue({ programs: [], hasLegacyConflicts: true });
    if (scenario === 'cycles')
      f.session.findCommitments.mockResolvedValue({ programs: [], hasLegacyCycles: true });
    if (scenario === 'identity')
      f.session.findIdentities.mockRejectedValue(new Error('Identidad ficticia'));
    if (scenario === 'source')
      f.frequencyQueryPort.findWithStops.mockRejectedValue(new Error('Proveedor ficticio'));
    await expect(f.save({ ...f.context, ...f.body })).rejects.toBeInstanceOf(Error);
    expect(f.session.save).not.toHaveBeenCalled();
  },
);

test('proveedor ausente falla cerrado', async () => {
  const f = setup();
  await expect(saveFactory({})({ ...f.context, ...f.body })).rejects.toMatchObject({
    code: 'ROUTE_PROGRAMMING_SOURCE_UNAVAILABLE',
  });
  f.session.frequencyQueryPort = null;
  await expect(f.save({ ...f.context, ...f.body })).rejects.toMatchObject({
    code: 'ROUTE_PROGRAMMING_SOURCE_UNAVAILABLE',
  });
});

test('servicio nocturno conserva fecha de parada y traslado explícito cierra el patrón', async () => {
  const f = setup();
  const p = f.body.programming;
  const agenda = p.agendas[0];
  const first = agenda.activities[0];
  f.frequencies[0].departureTime = '23:00';
  f.frequencies[0].stops = ['Latacunga'];
  p.cycleLengthDays = 2;
  first.departureAt = '2026-11-02T23:00:00-05:00';
  first.arrivalAt = '2026-11-03T02:00:00-05:00';
  first.points = [
    { position: 0, departureAt: first.departureAt },
    {
      position: 1,
      arrivalAt: '2026-11-03T00:15:00-05:00',
      departureAt: '2026-11-03T00:20:00-05:00',
    },
    { position: 2, arrivalAt: first.arrivalAt },
  ];
  f.frequencies[0].destination = 'Quito';
  const transfer = {
    id: agenda.activities[1].id,
    kind: 'TRANSFER',
    originKey: 'Quito',
    destinationKey: 'Ambato',
    departureAt: '2026-11-03T02:15:00-05:00',
    arrivalAt: '2026-11-03T05:00:00-05:00',
    preparationMinutes: 0,
  };
  agenda.activities = [first, transfer];
  agenda.blocks = [
    {
      id: randomUUID(),
      kind: 'MAINTENANCE',
      startAt: '2026-11-03T06:00:00-05:00',
      endAt: '2026-11-03T10:00:00-05:00',
      reason: 'Revisión programada',
    },
  ];
  p.requiredServices = [
    { id: first.requiredServiceId, frequencyId: first.frequencyId, departureAt: first.departureAt },
  ];
  const result = await f.save({ ...f.context, ...f.body });
  expect(result.programming.agendas[0].activities[0].points[1]).toMatchObject({
    departureAt: '2026-11-03T05:20:00.000Z',
    locationKey: 'Latacunga',
  });
  expect(result.programming.agendas[0].blocks[0].reason).toBe('Revisión programada');
  expect(result.programming.agendas[0].activities[1].kind).toBe('TRANSFER');
});
