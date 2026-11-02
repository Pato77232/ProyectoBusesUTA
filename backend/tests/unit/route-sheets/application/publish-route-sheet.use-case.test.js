const publishRouteSheetUseCase = require('../../../../src/modules/route-sheets/application/use-cases/publish-route-sheet.use-case');
const {
  TariffNotFoundError,
} = require('../../../../src/modules/route-sheets/domain/errors/route-tariff-errors');
const {
  createDraftTariff,
  parseTariffRequest,
} = require('../../../../src/modules/route-sheets/domain/value-objects/draft-tariff');
const RouteSheet = require('../../../../src/modules/route-sheets/domain/entities/route-sheet');
const { programmingSessionFixture } = require('../../../helpers/single-frequency-programming');

const routeSheetId = '10000000-0000-4000-8000-000000000001';
const cooperativeId = '20000000-0000-4000-8000-000000000002';
const busGroupId = '30000000-0000-4000-8000-000000000003';
const frequencyId = '40000000-0000-4000-8000-000000000004';
const publishedBy = '50000000-0000-4000-8000-000000000005';
const context = { routeSheetId, cooperativeId, publishedBy };

describe('PublishRouteSheet use case', () => {
  test('publica hoja de ruta exitosamente', async () => {
    const routeSheet = new RouteSheet({
      id: routeSheetId,
      cooperativeId,
      busGroupId,
      routeDate: '2026-10-25',
    });
    const tariff = createDraftTariff(
      parseTariffRequest({
        expectedRevision: 0,
        policy: {
          vipSurchargeBps: 2500,
          minorDiscountBps: 5000,
          seniorDiscountBps: 5000,
          disabilityDiscountBps: 5000,
        },
        frequencies: [
          { frequencyId, prices: [{ fromPosition: 0, toPosition: 1, amountCents: 450 }] },
        ],
      }),
      new Map([[frequencyId, ['Ambato', 'Quito']]]),
    );
    const freeze = jest.fn(async () => {
      routeSheet.publish(publishedBy);
      return routeSheet;
    });
    const frequencyQueryPort = {
      findWithStops: jest.fn().mockResolvedValue({
        id: frequencyId,
        cooperativeId,
        status: 'ACTIVE',
        origin: 'Ambato',
        destination: 'Quito',
        stops: [],
        departureTime: '07:00',
        antResolutionNumber: 'ANT-FICTICIA',
      }),
    };
    const session = programmingSessionFixture({
      busId: busGroupId,
      frequencyId,
      cooperativeId,
      busGroupId,
      date: '2026-10-25',
    });
    const tariffRepository = {
      withLockedSheet: jest.fn(async (_context, operation) =>
        operation({
          sheet: {
            status: 'DRAFT',
            cooperative_id: cooperativeId,
            tariff_revision: 1,
            tariff_draft: tariff,
            bus_group_id: busGroupId,
            programming_route_date: '2026-10-25',
          },
          frequencyIds: [frequencyId],
          frequencyQueryPort,
          freeze,
          programmingSession: async () => session,
        }),
      ),
    };
    const useCase = publishRouteSheetUseCase({
      tariffRepository,
      busQueryPort: session.busQueryPort,
    });

    const result = await useCase({ ...context, expectedRevision: 1 });

    expect(result.status).toBe('PUBLISHED');
    expect(result.id).toBe(routeSheetId);
    expect(tariffRepository.withLockedSheet).toHaveBeenCalledWith(
      { routeSheetId, cooperativeId, modifiedBy: publishedBy },
      expect.any(Function),
    );
    expect(frequencyQueryPort.findWithStops).toHaveBeenCalledWith(frequencyId, cooperativeId);
    expect(freeze).toHaveBeenCalledTimes(1);
    expect(freeze).toHaveBeenCalledWith(tariff);
  });

  test('lanza error si hoja no existe', async () => {
    const error = new TariffNotFoundError();
    const tariffRepository = {
      withLockedSheet: jest.fn().mockRejectedValue(error),
    };
    const useCase = publishRouteSheetUseCase({ tariffRepository });

    await expect(useCase(context)).rejects.toBe(error);
    expect(error).toMatchObject({ code: 'ROUTE_SHEET_NOT_FOUND', httpStatus: 404 });
    expect(tariffRepository.withLockedSheet).toHaveBeenCalledWith(
      { routeSheetId, cooperativeId, modifiedBy: publishedBy },
      expect.any(Function),
    );
  });
});
