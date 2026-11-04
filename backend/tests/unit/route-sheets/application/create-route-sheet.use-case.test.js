const createRouteSheetUseCase = require('../../../../src/modules/route-sheets/application/use-cases/create-route-sheet.use-case');
const { RouteSheetAlreadyExistsForDateAndGroupError, BusGroupNotFromCooperativeError, MissingBusGroupForRouteSheetError } = require('../../../../src/modules/route-sheets/domain/errors/route-sheet-errors');

describe('CreateRouteSheet use case', () => {
  test('crea hoja de ruta con éxito', async () => {
    const routeSheetRepository = {
      existsByDateAndGroup: jest.fn().mockResolvedValue(false),
      save: jest.fn().mockImplementation((routeSheet) => Promise.resolve({ ...routeSheet, id: 'rs-1' })),
    };
    const busGroupQueryPort = {
      findById: jest.fn().mockResolvedValue({ id: 'bg-1', cooperative_id: 'coop-1' }),
    };
    const useCase = createRouteSheetUseCase({ routeSheetRepository, busGroupQueryPort });

    const result = await useCase({ cooperativeId: 'coop-1', routeDate: '2026-10-25', busGroupId: 'bg-1', createdBy: 'user-1' });

    expect(result.id).toBe('rs-1');
    expect(result.cooperativeId).toBe('coop-1');
    expect(result.busGroupId).toBe('bg-1');
    expect(routeSheetRepository.save).toHaveBeenCalled();
  });

  test('lanza error si ya existe hoja para fecha y grupo', async () => {
    const routeSheetRepository = {
      existsByDateAndGroup: jest.fn().mockResolvedValue(true),
      save: jest.fn(),
    };
    const busGroupQueryPort = {
      findById: jest.fn().mockResolvedValue({ id: 'bg-1' }),
    };
    const useCase = createRouteSheetUseCase({ routeSheetRepository, busGroupQueryPort });

    await expect(useCase({ cooperativeId: 'coop-1', routeDate: '2026-10-25', busGroupId: 'bg-1' })).rejects.toThrow(RouteSheetAlreadyExistsForDateAndGroupError);
  });

  test('lanza error si falta busGroupId', async () => {
    const routeSheetRepository = { existsByDateAndGroup: jest.fn(), save: jest.fn() };
    const busGroupQueryPort = { findById: jest.fn() };
    const useCase = createRouteSheetUseCase({ routeSheetRepository, busGroupQueryPort });

    await expect(useCase({ cooperativeId: 'coop-1', routeDate: '2026-10-25' })).rejects.toThrow(MissingBusGroupForRouteSheetError);
  });

  test('lanza error si bus group no pertenece a cooperativa', async () => {
    const routeSheetRepository = { existsByDateAndGroup: jest.fn().mockResolvedValue(false), save: jest.fn() };
    const busGroupQueryPort = { findById: jest.fn().mockResolvedValue(null) };
    const useCase = createRouteSheetUseCase({ routeSheetRepository, busGroupQueryPort });

    await expect(useCase({ cooperativeId: 'coop-1', routeDate: '2026-10-25', busGroupId: 'bg-1' })).rejects.toThrow(BusGroupNotFromCooperativeError);
  });
});
