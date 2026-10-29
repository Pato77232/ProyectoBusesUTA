const publishRouteSheetUseCase = require('../../../../src/modules/route-sheets/application/use-cases/publish-route-sheet.use-case');
const { RouteSheetNotFoundError } = require('../../../../src/modules/route-sheets/domain/errors/route-sheet-errors');
const RouteSheet = require('../../../../src/modules/route-sheets/domain/entities/route-sheet');

describe('PublishRouteSheet use case', () => {
  test('publica hoja de ruta exitosamente', async () => {
    const routeSheet = new RouteSheet({
      id: 'rs-1',
      cooperativeId: 'coop-1',
      busGroupId: 'bg-1',
      routeDate: '2026-10-25',
    });
    const routeSheetRepository = {
      findById: jest.fn().mockResolvedValue(routeSheet),
      save: jest.fn().mockImplementation((rs) => Promise.resolve(rs)),
    };
    const useCase = publishRouteSheetUseCase({ routeSheetRepository });

    const result = await useCase({ routeSheetId: 'rs-1', cooperativeId: 'coop-1', publishedBy: 'user-1' });

    expect(result.status).toBe('PUBLISHED');
    expect(routeSheetRepository.save).toHaveBeenCalled();
  });

  test('lanza error si hoja no existe', async () => {
    const routeSheetRepository = {
      findById: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
    };
    const useCase = publishRouteSheetUseCase({ routeSheetRepository });

    await expect(useCase({ routeSheetId: 'rs-1', cooperativeId: 'coop-1', publishedBy: 'user-1' })).rejects.toThrow(RouteSheetNotFoundError);
  });
});
