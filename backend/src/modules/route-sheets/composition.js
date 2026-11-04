const createRouter = require('./interfaces/http/route-sheet.routes');
const getEditorFactory = require('./application/use-cases/get-route-sheet-editor.use-case');
const PgEditorRepository = require('./infrastructure/repositories/pg-route-sheet-editor-repository');
const { randomUUID } = require('node:crypto');
const prepareRenewalFactory = require('./application/use-cases/prepare-route-sheet-renewal.use-case');
const PgRenewalRepository = require('./infrastructure/repositories/pg-route-sheet-renewal-repository');
const createTariffQueries = require('./application/create-tariff-queries');
const configureTariffFactory = require('./application/use-cases/configure-route-sheet-tariff.use-case');
const PgRouteSheetTariffRepository = require('./infrastructure/repositories/pg-route-sheet-tariff-repository');
const PgProgrammingRepository = require('./infrastructure/repositories/pg-route-sheet-programming-repository');
const saveProgrammingFactory = require('./application/use-cases/save-route-sheet-programming.use-case');
const getProgrammingFactory = require('./application/use-cases/get-route-sheet-programming.use-case');
const assertLegacyFactory = require('./application/use-cases/assert-legacy-programming-operation.use-case');
const legacyProgrammingPool = require('./infrastructure/legacy-programming-pool');
const createTripQueries = require('./application/create-trip-queries');
const PgTripQueryRepository = require('./infrastructure/repositories/pg-commercial-trip-query-repository');

const createRouteSheetUseCaseFactory = require('./application/use-cases/create-route-sheet.use-case');
const getRouteSheetByDateAndGroupUseCaseFactory = require('./application/use-cases/get-route-sheet-by-date-and-group.use-case');
const listRouteSheetsUseCaseFactory = require('./application/use-cases/list-route-sheets.use-case');
const addAssignmentToRouteSheetUseCaseFactory = require('./application/use-cases/add-assignment-to-route-sheet.use-case');
const removeAssignmentFromRouteSheetUseCaseFactory = require('./application/use-cases/remove-assignment-from-route-sheet.use-case');
const addRestDayToRouteSheetUseCaseFactory = require('./application/use-cases/add-rest-day-to-route-sheet.use-case');
const removeRestDayFromRouteSheetUseCaseFactory = require('./application/use-cases/remove-rest-day-from-route-sheet.use-case');
const publishRouteSheetUseCaseFactory = require('./application/use-cases/publish-route-sheet.use-case');
const generateAutomaticCyclesUseCaseFactory = require('./application/use-cases/generate-automatic-cycles.use-case');
const getRouteSheetModificationLogsUseCaseFactory = require('./application/use-cases/get-route-sheet-modification-logs.use-case');
const getRouteSheetPurchaseWindowUseCaseFactory = require('./application/use-cases/get-route-sheet-purchase-window.use-case');

const PgRouteSheetRepository = require('./infrastructure/repositories/pg-route-sheet-repository');
const PgRouteSheetAssignmentRepository = require('./infrastructure/repositories/pg-route-sheet-assignment-repository');
const PgRouteSheetRestDayRepository = require('./infrastructure/repositories/pg-route-sheet-rest-day-repository');
const PgRouteSheetCycleRepository = require('./infrastructure/repositories/pg-route-sheet-cycle-repository');
const PgRouteSheetModificationLogRepository = require('./infrastructure/repositories/pg-route-sheet-modification-log-repository');

const FrequencyQueryAdapter = require('./infrastructure/adapters/frequency-query-adapter');
const BusGroupQueryAdapter = require('./infrastructure/adapters/bus-group-query-adapter');
const BusQueryAdapter = require('./infrastructure/adapters/bus-query-adapter');
const BookingQueryAdapter = require('./infrastructure/adapters/booking-query-adapter');
const createBookingQueries = require('./infrastructure/adapters/create-booking-queries');

function createRouteSheetsModule({
  pool,
  auth,
  frequencyQueries,
  busGroupQueries,
  busQueries,
  seatQueries,
  bookingQueries,
  occupancyQueries,
} = {}) {
  const legacyPool = legacyProgrammingPool(pool);
  const routeSheetRepository = new PgRouteSheetRepository(legacyPool);
  const routeSheetAssignmentRepository = new PgRouteSheetAssignmentRepository(legacyPool);
  const routeSheetRestDayRepository = new PgRouteSheetRestDayRepository(legacyPool);
  const routeSheetCycleRepository = new PgRouteSheetCycleRepository(legacyPool);
  const routeSheetModificationLogRepository = new PgRouteSheetModificationLogRepository(pool);

  const frequencyQueryPort = new FrequencyQueryAdapter({ frequencyQueries });
  const busGroupQueryPort = new BusGroupQueryAdapter({ busGroupQueries });
  const busQueryPort = new BusQueryAdapter({ busQueries });
  const bookingQueryPort = new BookingQueryAdapter({
    bookingQueries:
      bookingQueries ??
      (occupancyQueries ? createBookingQueries({ pool, occupancyQueries }) : undefined),
  });
  const programmingRepository = new PgProgrammingRepository(pool, {
    frequencySessionFactory: frequencyQueries.forTransaction,
  });
  const saveProgrammingUseCase = saveProgrammingFactory({ programmingRepository, busQueryPort });
  const getProgrammingUseCase = getProgrammingFactory({ programmingRepository });
  const assertLegacyProgrammingOperation = assertLegacyFactory({
    getProgramming: getProgrammingUseCase,
  });
  const tariffRepository = new PgRouteSheetTariffRepository(pool, {
    frequencySessionFactory: frequencyQueries.forTransaction,
  });
  const configureTariffUseCase = configureTariffFactory({
    tariffRepository,
    frequencyQueryPort,
  });
  const prepareRenewalUseCase = prepareRenewalFactory({
    renewalRepository: new PgRenewalRepository(pool, {
      frequencySessionFactory: frequencyQueries.forTransaction,
    }),
    busQueryPort,
    now: () => new Date().toISOString(),
    newId: randomUUID,
  });

  const createRouteSheetUseCase = createRouteSheetUseCaseFactory({
    routeSheetRepository,
    busGroupQueryPort,
  });
  const getRouteSheetByDateAndGroupUseCase = getRouteSheetByDateAndGroupUseCaseFactory({
    routeSheetRepository,
    routeSheetAssignmentRepository,
    routeSheetRestDayRepository,
  });
  const listRouteSheetsUseCase = listRouteSheetsUseCaseFactory({ routeSheetRepository });
  const addAssignmentToRouteSheetUseCase = addAssignmentToRouteSheetUseCaseFactory({
    routeSheetRepository,
    routeSheetAssignmentRepository,
    routeSheetModificationLogRepository,
    frequencyQueryPort,
    busQueryPort,
    bookingQueryPort,
  });
  const removeAssignmentFromRouteSheetUseCase = removeAssignmentFromRouteSheetUseCaseFactory({
    routeSheetRepository,
    routeSheetAssignmentRepository,
    routeSheetModificationLogRepository,
    bookingQueryPort,
  });
  const addRestDayToRouteSheetUseCase = addRestDayToRouteSheetUseCaseFactory({
    routeSheetRepository,
    routeSheetRestDayRepository,
    routeSheetAssignmentRepository,
    routeSheetModificationLogRepository,
    busQueryPort,
    bookingQueryPort,
  });
  const removeRestDayFromRouteSheetUseCase = removeRestDayFromRouteSheetUseCaseFactory({
    routeSheetRepository,
    routeSheetRestDayRepository,
    routeSheetAssignmentRepository,
    routeSheetModificationLogRepository,
    bookingQueryPort,
  });
  const publishRouteSheetUseCase = publishRouteSheetUseCaseFactory({
    tariffRepository,
    busQueryPort,
    seatQueryPort: seatQueries,
  });
  const generateAutomaticCyclesUseCase = generateAutomaticCyclesUseCaseFactory({
    routeSheetRepository,
    routeSheetAssignmentRepository,
    routeSheetRestDayRepository,
    routeSheetCycleRepository,
  });
  const getRouteSheetModificationLogsUseCase = getRouteSheetModificationLogsUseCaseFactory({
    routeSheetRepository,
    routeSheetModificationLogRepository,
  });
  const getRouteSheetPurchaseWindowUseCase = getRouteSheetPurchaseWindowUseCaseFactory({
    routeSheetRepository,
    routeSheetCycleRepository,
  });

  return {
    tripQueries: createTripQueries({
      tripRepository: new PgTripQueryRepository(pool),
      frequencyQueryPort,
      busQueryPort,
    }),
    tariffQueries: createTariffQueries({ tariffRepository }),
    router: createRouter({
      auth,
      getEditorUseCase: getEditorFactory({
        editorRepository: new PgEditorRepository(pool),
        busQueryPort,
        busGroupQueryPort,
        frequencyQueryPort,
      }),
      configureTariffUseCase,
      prepareRenewalUseCase,
      saveProgrammingUseCase,
      getProgrammingUseCase,
      assertLegacyProgrammingOperation,
      createRouteSheetUseCase,
      getRouteSheetByDateAndGroupUseCase,
      listRouteSheetsUseCase,
      addAssignmentToRouteSheetUseCase,
      removeAssignmentFromRouteSheetUseCase,
      addRestDayToRouteSheetUseCase,
      removeRestDayFromRouteSheetUseCase,
      publishRouteSheetUseCase,
      generateAutomaticCyclesUseCase,
      getRouteSheetModificationLogsUseCase,
      getRouteSheetPurchaseWindowUseCase,
    }),
  };
}

module.exports = createRouteSheetsModule;
