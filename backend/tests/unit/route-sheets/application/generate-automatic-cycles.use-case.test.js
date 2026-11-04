const generateAutomaticCyclesUseCase = require('../../../../src/modules/route-sheets/application/use-cases/generate-automatic-cycles.use-case');
const RouteSheet = require('../../../../src/modules/route-sheets/domain/entities/route-sheet');
const { MaxAutomaticCyclesExceededError, CycleGenerationNotAllowedError } = require('../../../../src/modules/route-sheets/domain/errors/route-sheet-errors');

describe('GenerateAutomaticCycles use case', () => {
  test('genera exactamente 2 ciclos desde hoja base', async () => {
    const baseRouteSheet = new RouteSheet({
      id: 'rs-base',
      cooperativeId: 'coop-1',
      busGroupId: 'bg-1',
      routeDate: '2026-10-25',
    });
    baseRouteSheet.isBase = true;
    baseRouteSheet.status = require('../../../../src/modules/route-sheets/domain/value-objects/route-sheet-status').published();

    const routeSheetRepository = {
      findById: jest.fn().mockResolvedValue(baseRouteSheet),
      save: jest.fn(),
    };
    const routeSheetAssignmentRepository = {
      findByRouteSheetId: jest.fn().mockResolvedValue([{ id: 'a1' }]),
    };
    const routeSheetRestDayRepository = {
      findByRouteSheetId: jest.fn().mockResolvedValue([{ id: 'r1' }]),
    };
    const routeSheetCycleRepository = {
      countByBaseRouteSheetId: jest.fn().mockResolvedValue(0),
      save: jest.fn().mockImplementation((cycle) => Promise.resolve({ ...cycle, id: 'c' + cycle.cycleNumber })),
    };

    const useCase = generateAutomaticCyclesUseCase({
      routeSheetRepository,
      routeSheetAssignmentRepository,
      routeSheetRestDayRepository,
      routeSheetCycleRepository,
    });

    const result = await useCase({ baseRouteSheetId: 'rs-base', cooperativeId: 'coop-1', generatedBy: 'user-1', cycleLengthWeeks: 2 });

    expect(result.cycles).toHaveLength(2);
    expect(result.cycles[0].cycleNumber).toBe(1);
    expect(result.cycles[1].cycleNumber).toBe(2);
    expect(routeSheetCycleRepository.save).toHaveBeenCalledTimes(2);
  });

  test('lanza error si ya existen 2 ciclos', async () => {
    const baseRouteSheet = new RouteSheet({
      id: 'rs-base',
      cooperativeId: 'coop-1',
      busGroupId: 'bg-1',
      routeDate: '2026-10-25',
    });
    baseRouteSheet.isBase = true;
    const routeSheetRepository = { findById: jest.fn().mockResolvedValue(baseRouteSheet), save: jest.fn() };
    const routeSheetAssignmentRepository = { findByRouteSheetId: jest.fn().mockResolvedValue([]) };
    const routeSheetRestDayRepository = { findByRouteSheetId: jest.fn().mockResolvedValue([]) };
    const routeSheetCycleRepository = { countByBaseRouteSheetId: jest.fn().mockResolvedValue(2), save: jest.fn() };

    const useCase = generateAutomaticCyclesUseCase({
      routeSheetRepository,
      routeSheetAssignmentRepository,
      routeSheetRestDayRepository,
      routeSheetCycleRepository,
    });

    await expect(useCase({ baseRouteSheetId: 'rs-base', cooperativeId: 'coop-1', generatedBy: 'user-1' })).rejects.toThrow(MaxAutomaticCyclesExceededError);
  });

  test('lanza error si no hay hoja base apta', async () => {
    const routeSheetRepository = { findById: jest.fn().mockResolvedValue(null), save: jest.fn() };
    const routeSheetAssignmentRepository = { findByRouteSheetId: jest.fn() };
    const routeSheetRestDayRepository = { findByRouteSheetId: jest.fn() };
    const routeSheetCycleRepository = { countByBaseRouteSheetId: jest.fn() };

    const useCase = generateAutomaticCyclesUseCase({
      routeSheetRepository,
      routeSheetAssignmentRepository,
      routeSheetRestDayRepository,
      routeSheetCycleRepository,
    });

    await expect(useCase({ baseRouteSheetId: 'rs-base', cooperativeId: 'coop-1', generatedBy: 'user-1' })).rejects.toThrow(CycleGenerationNotAllowedError);
  });
});
