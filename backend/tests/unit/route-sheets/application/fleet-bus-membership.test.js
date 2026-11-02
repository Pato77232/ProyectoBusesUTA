const { randomUUID } = require('node:crypto');
const RouteSheet = require('../../../../src/modules/route-sheets/domain/entities/route-sheet');
const BusQueryAdapter = require('../../../../src/modules/route-sheets/infrastructure/adapters/bus-query-adapter');
const addAssignment = require('../../../../src/modules/route-sheets/application/use-cases/add-assignment-to-route-sheet.use-case');
const addRestDay = require('../../../../src/modules/route-sheets/application/use-cases/add-rest-day-to-route-sheet.use-case');

let sheet, request, dependencies;
beforeEach(() => {
  sheet = new RouteSheet({
    id: randomUUID(),
    cooperativeId: randomUUID(),
    busGroupId: randomUUID(),
    routeDate: '2026-11-03',
  });
  request = {
    routeSheetId: sheet.id,
    cooperativeId: sheet.cooperativeId,
    busId: randomUUID(),
    frequencyId: randomUUID(),
  };
  dependencies = {
    routeSheetRepository: { findById: jest.fn().mockResolvedValue(sheet) },
    routeSheetAssignmentRepository: {
      findByRouteSheetId: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (entity) => entity),
    },
    routeSheetRestDayRepository: {
      findByRouteSheetId: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (entity) => entity),
    },
    frequencyQueryPort: {
      findById: jest.fn().mockResolvedValue({ status: 'ACTIVE' }),
      findActiveByCooperativeId: jest.fn().mockResolvedValue([{}]),
    },
    busQueryPort: {
      findById: jest.fn().mockResolvedValue({ id: request.busId, busGroupId: sheet.busGroupId }),
    },
  };
});

describe.each([
  ['asignación', addAssignment],
  ['parada', addRestDay],
])('%s', (label, factory) => {
  test('bus de otro grupo devuelve 409 antes de consultar o escribir asignaciones/paradas', async () => {
    dependencies.busQueryPort.findById.mockResolvedValue({
      id: request.busId,
      busGroupId: randomUUID(),
    });
    await expect(factory(dependencies)(request)).rejects.toMatchObject({
      code: 'BUS_NOT_IN_ROUTE_SHEET_GROUP',
      httpStatus: 409,
    });
    expect(dependencies.routeSheetAssignmentRepository.findByRouteSheetId).not.toHaveBeenCalled();
    expect(dependencies.routeSheetAssignmentRepository.save).not.toHaveBeenCalled();
    expect(dependencies.routeSheetRestDayRepository.save).not.toHaveBeenCalled();
  });

  test('resumen sin busGroupId no omite la comprobación de pertenencia', async () => {
    dependencies.busQueryPort.findById.mockResolvedValue({ id: request.busId });
    await expect(factory(dependencies)(request)).rejects.toMatchObject({
      code: 'BUS_NOT_IN_ROUTE_SHEET_GROUP',
    });
  });

  test('bus ausente o ajeno conserva 403 y no escribe filas', async () => {
    dependencies.busQueryPort.findById.mockResolvedValue(null);
    await expect(factory(dependencies)(request)).rejects.toMatchObject({
      code: 'BUS_NOT_FROM_COOPERATIVE',
      httpStatus: 403,
    });
    expect(dependencies.routeSheetAssignmentRepository.save).not.toHaveBeenCalled();
    expect(dependencies.routeSheetRestDayRepository.save).not.toHaveBeenCalled();
  });

  test('bus del grupo continúa y transmite la cooperativa al puerto', async () => {
    const result = await factory(dependencies)(request);
    expect(result.id).toBe(sheet.id);
    expect(dependencies.busQueryPort.findById).toHaveBeenCalledWith(
      request.busId,
      request.cooperativeId,
    );
    const saved =
      label === 'asignación'
        ? dependencies.routeSheetAssignmentRepository.save
        : dependencies.routeSheetRestDayRepository.save;
    expect(saved).toHaveBeenCalledWith(
      expect.objectContaining({
        busId: request.busId,
        busGroupId: sheet.busGroupId,
        cooperativeId: sheet.cooperativeId,
      }),
    );
  });
});

test('adaptador delega los tres métodos a la API pública con argumentos en el mismo orden', async () => {
  const busQueries = {
    findById: jest.fn().mockResolvedValue({ id: request.busId }),
    findByCooperativeId: jest.fn().mockResolvedValue([]),
    findByBusGroupId: jest.fn().mockResolvedValue([]),
  };
  const adapter = new BusQueryAdapter({ busQueries });
  await expect(adapter.findById(request.busId, request.cooperativeId)).resolves.toEqual({
    id: request.busId,
  });
  await adapter.findByCooperativeId(request.cooperativeId);
  await adapter.findByBusGroupId(sheet.busGroupId, request.cooperativeId);
  expect(busQueries.findById).toHaveBeenCalledWith(request.busId, request.cooperativeId);
  expect(busQueries.findByCooperativeId).toHaveBeenCalledWith(request.cooperativeId);
  expect(busQueries.findByBusGroupId).toHaveBeenCalledWith(sheet.busGroupId, request.cooperativeId);
});

test('una avería de Fleet se propaga, sin convertirse en ausencia de buses', async () => {
  const failure = new Error('Consulta de prueba fallida');
  const adapter = new BusQueryAdapter({
    busQueries: { findById: jest.fn().mockRejectedValue(failure) },
  });
  await expect(adapter.findById(request.busId, request.cooperativeId)).rejects.toBe(failure);
});
