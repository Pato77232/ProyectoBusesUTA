const { randomUUID } = require('node:crypto');
const RouteSheet = require('../../../../src/modules/route-sheets/domain/entities/route-sheet');
const RouteSheetAssignment = require('../../../../src/modules/route-sheets/domain/entities/route-sheet-assignment');
const RouteSheetRestDay = require('../../../../src/modules/route-sheets/domain/entities/route-sheet-rest-day');
const addAssignment = require('../../../../src/modules/route-sheets/application/use-cases/add-assignment-to-route-sheet.use-case');
const removeAssignment = require('../../../../src/modules/route-sheets/application/use-cases/remove-assignment-from-route-sheet.use-case');
const addRestDay = require('../../../../src/modules/route-sheets/application/use-cases/add-rest-day-to-route-sheet.use-case');
const removeRestDay = require('../../../../src/modules/route-sheets/application/use-cases/remove-rest-day-from-route-sheet.use-case');

const MODIFIED_BY = randomUUID();
const REASON = '  Ajuste operativo del día  ';

let sheet;
let assignment;
let restDay;
let logRepository;
let dependencies;

beforeEach(() => {
  sheet = new RouteSheet({
    id: randomUUID(),
    cooperativeId: randomUUID(),
    busGroupId: randomUUID(),
    routeDate: '2026-11-04',
  });
  assignment = new RouteSheetAssignment({
    id: randomUUID(),
    routeSheetId: sheet.id,
    cooperativeId: sheet.cooperativeId,
    busGroupId: sheet.busGroupId,
    busId: randomUUID(),
    frequencyId: randomUUID(),
  });
  restDay = new RouteSheetRestDay({
    id: randomUUID(),
    routeSheetId: sheet.id,
    cooperativeId: sheet.cooperativeId,
    busGroupId: sheet.busGroupId,
    busId: randomUUID(),
  });
  logRepository = { save: jest.fn(async (log) => ({ ...log, id: randomUUID() })) };
  dependencies = {
    routeSheetRepository: { findById: jest.fn().mockResolvedValue(sheet) },
    routeSheetAssignmentRepository: {
      findByRouteSheetId: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (entity) => ({ ...entity, id: randomUUID() })),
      removeById: jest.fn().mockResolvedValue(undefined),
    },
    routeSheetRestDayRepository: {
      findByRouteSheetId: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (entity) => ({ ...entity, id: randomUUID() })),
      removeById: jest.fn().mockResolvedValue(undefined),
    },
    routeSheetModificationLogRepository: logRepository,
    frequencyQueryPort: {
      findById: jest.fn().mockResolvedValue({ status: 'ACTIVE' }),
      findActiveByCooperativeId: jest.fn().mockResolvedValue([{}]),
    },
    busQueryPort: {
      findById: jest.fn(async (busId) => ({ id: busId, busGroupId: sheet.busGroupId })),
    },
  };
});

function addAssignmentRequest(overrides = {}) {
  return {
    routeSheetId: sheet.id,
    cooperativeId: sheet.cooperativeId,
    busId: randomUUID(),
    frequencyId: randomUUID(),
    modifiedBy: MODIFIED_BY,
    ...overrides,
  };
}

test('agregar una asignación con motivo escribe un log CREATE con los valores nuevos', async () => {
  const request = addAssignmentRequest({ reason: REASON });

  await addAssignment(dependencies)(request);

  expect(logRepository.save).toHaveBeenCalledTimes(1);
  const saved = await dependencies.routeSheetAssignmentRepository.save.mock.results[0].value;
  expect(logRepository.save.mock.calls[0][0]).toMatchObject({
    routeSheetId: sheet.id,
    cooperativeId: sheet.cooperativeId,
    busGroupId: sheet.busGroupId,
    modifiedBy: MODIFIED_BY,
    reason: 'Ajuste operativo del día',
    action: 'CREATE',
    affectedEntity: 'ASSIGNMENT',
    entityId: saved.id,
    oldValue: null,
    newValue: { busId: request.busId, frequencyId: request.frequencyId },
    hasPassengersWarning: false,
  });
});

test('agregar una asignación sin motivo aplica el cambio y no escribe auditoría', async () => {
  await addAssignment(dependencies)(addAssignmentRequest());

  expect(dependencies.routeSheetAssignmentRepository.save).toHaveBeenCalledTimes(1);
  expect(logRepository.save).not.toHaveBeenCalled();
});

test('quitar una asignación con motivo escribe un log DELETE con el valor anterior y la advertencia', async () => {
  dependencies.routeSheetAssignmentRepository.findByRouteSheetId.mockResolvedValue([assignment]);
  dependencies.bookingQueryPort = {
    hasPassengersForAssignment: jest.fn().mockResolvedValue(true),
  };

  await removeAssignment(dependencies)({
    routeSheetId: sheet.id,
    cooperativeId: sheet.cooperativeId,
    assignmentId: assignment.id,
    modifiedBy: MODIFIED_BY,
    reason: REASON,
    forceWithPassengersWarning: true,
  });

  expect(logRepository.save).toHaveBeenCalledTimes(1);
  expect(logRepository.save.mock.calls[0][0]).toMatchObject({
    action: 'DELETE',
    affectedEntity: 'ASSIGNMENT',
    entityId: assignment.id,
    reason: 'Ajuste operativo del día',
    oldValue: { busId: assignment.busId, frequencyId: assignment.frequencyId },
    newValue: null,
    hasPassengersWarning: true,
  });
});

test('quitar una asignación inexistente no escribe auditoría de un cambio no aplicado', async () => {
  await removeAssignment(dependencies)({
    routeSheetId: sheet.id,
    cooperativeId: sheet.cooperativeId,
    assignmentId: randomUUID(),
    modifiedBy: MODIFIED_BY,
    reason: REASON,
  });

  expect(logRepository.save).not.toHaveBeenCalled();
});

test('agregar una parada de descanso usa reasonForChange y registra el bus', async () => {
  const request = addAssignmentRequest({ reasonForChange: REASON });

  await addRestDay(dependencies)(request);

  expect(logRepository.save).toHaveBeenCalledTimes(1);
  const saved = await dependencies.routeSheetRestDayRepository.save.mock.results[0].value;
  expect(logRepository.save.mock.calls[0][0]).toMatchObject({
    action: 'CREATE',
    affectedEntity: 'REST_DAY',
    entityId: saved.id,
    reason: 'Ajuste operativo del día',
    newValue: { busId: request.busId },
  });
});

test('quitar una parada de descanso con motivo escribe un log DELETE con el bus', async () => {
  dependencies.routeSheetRestDayRepository.findByRouteSheetId.mockResolvedValue([restDay]);
  dependencies.bookingQueryPort = {
    hasPassengersForBusOnRouteSheet: jest.fn().mockResolvedValue(false),
  };

  await removeRestDay(dependencies)({
    routeSheetId: sheet.id,
    cooperativeId: sheet.cooperativeId,
    restDayId: restDay.id,
    modifiedBy: MODIFIED_BY,
    reasonForChange: REASON,
  });

  expect(logRepository.save).toHaveBeenCalledTimes(1);
  expect(logRepository.save.mock.calls[0][0]).toMatchObject({
    action: 'DELETE',
    affectedEntity: 'REST_DAY',
    entityId: restDay.id,
    oldValue: { busId: restDay.busId },
    newValue: null,
    hasPassengersWarning: false,
  });
});

test('un fallo del repositorio de auditoría se propaga sin deshacer el cambio aplicado', async () => {
  const failure = new Error('Auditoría no disponible');
  logRepository.save.mockRejectedValue(failure);

  await expect(addAssignment(dependencies)(addAssignmentRequest({ reason: REASON }))).rejects.toBe(
    failure,
  );

  expect(dependencies.routeSheetAssignmentRepository.save).toHaveBeenCalledTimes(1);
});
