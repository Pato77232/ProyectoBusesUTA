const createRouter = require('./interfaces/http/route-sheet.routes');

const createRouteSheetUseCase = require('./application/use-cases/create-route-sheet.use-case');
const getRouteSheetByDateAndGroupUseCase = require('./application/use-cases/get-route-sheet-by-date-and-group.use-case');
const listRouteSheetsUseCase = require('./application/use-cases/list-route-sheets.use-case');
const addAssignmentToRouteSheetUseCase = require('./application/use-cases/add-assignment-to-route-sheet.use-case');
const removeAssignmentFromRouteSheetUseCase = require('./application/use-cases/remove-assignment-from-route-sheet.use-case');
const addRestDayToRouteSheetUseCase = require('./application/use-cases/add-rest-day-to-route-sheet.use-case');
const removeRestDayFromRouteSheetUseCase = require('./application/use-cases/remove-rest-day-from-route-sheet.use-case');
const publishRouteSheetUseCase = require('./application/use-cases/publish-route-sheet.use-case');
const generateAutomaticCyclesUseCase = require('./application/use-cases/generate-automatic-cycles.use-case');
const getRouteSheetModificationLogsUseCase = require('./application/use-cases/get-route-sheet-modification-logs.use-case');
const getRouteSheetPurchaseWindowUseCase = require('./application/use-cases/get-route-sheet-purchase-window.use-case');

const PgRouteSheetRepository = require('./infrastructure/repositories/pg-route-sheet-repository');
const PgRouteSheetAssignmentRepository = require('./infrastructure/repositories/pg-route-sheet-assignment-repository');
const PgRouteSheetRestDayRepository = require('./infrastructure/repositories/pg-route-sheet-rest-day-repository');
const PgRouteSheetCycleRepository = require('./infrastructure/repositories/pg-route-sheet-cycle-repository');
const PgRouteSheetModificationLogRepository = require('./infrastructure/repositories/pg-route-sheet-modification-log-repository');

const FrequencyQueryAdapter = require('./infrastructure/adapters/frequency-query-adapter');
const BusGroupQueryAdapter = require('./infrastructure/adapters/bus-group-query-adapter');
const BusQueryAdapter = require('./infrastructure/adapters/bus-query-adapter');
const BookingQueryAdapter = require('./infrastructure/adapters/booking-query-adapter');

function createRouteSheetsModule({ pool, auth, frequencyRepository, busGroupRepository, busRepository, bookingRepository } = {}) {
  const routeSheetRepository = new PgRouteSheetRepository(pool);
  const routeSheetAssignmentRepository = new PgRouteSheetAssignmentRepository(pool);
  const routeSheetRestDayRepository = new PgRouteSheetRestDayRepository(pool);
  const routeSheetCycleRepository = new PgRouteSheetCycleRepository(pool);
  const routeSheetModificationLogRepository = new PgRouteSheetModificationLogRepository(pool);

  const frequencyQueryPort = new FrequencyQueryAdapter({ frequencyRepository });
  const busGroupQueryPort = new BusGroupQueryAdapter({ busGroupRepository });
  const busQueryPort = new BusQueryAdapter({ busRepository });
  const bookingQueryPort = new BookingQueryAdapter({ bookingRepository });

  const createRouteSheetUseCase = createRouteSheetUseCase({ routeSheetRepository, busGroupQueryPort });
  const getRouteSheetByDateAndGroupUseCase = getRouteSheetByDateAndGroupUseCase({ routeSheetRepository, routeSheetAssignmentRepository, routeSheetRestDayRepository });
  const listRouteSheetsUseCase = listRouteSheetsUseCase({ routeSheetRepository });
  const addAssignmentToRouteSheetUseCase = addAssignmentToRouteSheetUseCase({ routeSheetRepository, routeSheetAssignmentRepository, frequencyQueryPort, busQueryPort, bookingQueryPort });
  const removeAssignmentFromRouteSheetUseCase = removeAssignmentFromRouteSheetUseCase({ routeSheetRepository, routeSheetAssignmentRepository, bookingQueryPort });
  const addRestDayToRouteSheetUseCase = addRestDayToRouteSheetUseCase({ routeSheetRepository, routeSheetRestDayRepository, routeSheetAssignmentRepository, busQueryPort, bookingQueryPort });
  const removeRestDayFromRouteSheetUseCase = removeRestDayFromRouteSheetUseCase({ routeSheetRepository, routeSheetRestDayRepository, routeSheetAssignmentRepository, bookingQueryPort });
  const publishRouteSheetUseCase = publishRouteSheetUseCase({ routeSheetRepository });
  const generateAutomaticCyclesUseCase = generateAutomaticCyclesUseCase({ routeSheetRepository, routeSheetAssignmentRepository, routeSheetRestDayRepository, routeSheetCycleRepository });
  const getRouteSheetModificationLogsUseCase = getRouteSheetModificationLogsUseCase({ routeSheetRepository, routeSheetModificationLogRepository });
  const getRouteSheetPurchaseWindowUseCase = getRouteSheetPurchaseWindowUseCase({ routeSheetRepository, routeSheetCycleRepository });

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
