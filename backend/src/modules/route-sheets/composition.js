const createRouter = require('./interfaces/http/route-sheet.routes');

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

function createRouteSheetsModule({
  pool,
  auth,
  frequencyRepository,
  busGroupQueries,
  busRepository,
  bookingRepository,
} = {}) {
  const routeSheetRepository = new PgRouteSheetRepository(pool);
  const routeSheetAssignmentRepository = new PgRouteSheetAssignmentRepository(pool);
  const routeSheetRestDayRepository = new PgRouteSheetRestDayRepository(pool);
  const routeSheetCycleRepository = new PgRouteSheetCycleRepository(pool);
  const routeSheetModificationLogRepository = new PgRouteSheetModificationLogRepository(pool);

  const frequencyQueryPort = new FrequencyQueryAdapter({ frequencyRepository });
  const busGroupQueryPort = new BusGroupQueryAdapter({ busGroupQueries });
  const busQueryPort = new BusQueryAdapter({ busRepository });
  const bookingQueryPort = new BookingQueryAdapter({ bookingRepository });

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
    frequencyQueryPort,
    busQueryPort,
    bookingQueryPort,
  });
  const removeAssignmentFromRouteSheetUseCase = removeAssignmentFromRouteSheetUseCaseFactory({
    routeSheetRepository,
    routeSheetAssignmentRepository,
    bookingQueryPort,
  });
  const addRestDayToRouteSheetUseCase = addRestDayToRouteSheetUseCaseFactory({
    routeSheetRepository,
    routeSheetRestDayRepository,
    routeSheetAssignmentRepository,
    busQueryPort,
    bookingQueryPort,
  });
  const removeRestDayFromRouteSheetUseCase = removeRestDayFromRouteSheetUseCaseFactory({
    routeSheetRepository,
    routeSheetRestDayRepository,
    routeSheetAssignmentRepository,
    bookingQueryPort,
  });
  const publishRouteSheetUseCase = publishRouteSheetUseCaseFactory({ routeSheetRepository });
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
    router: createRouter({
      auth,
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
