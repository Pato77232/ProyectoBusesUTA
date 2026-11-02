const createBusGroup = require('./application/create-bus-group.use-case');
const listBusGroups = require('./application/list-bus-groups.use-case');
const PgBusGroupRepository = require('./infrastructure/pg-bus-group.repository');
const createRouter = require('./interfaces/bus-group-router');
const listSeatLayouts = require('./application/list-seat-layouts.use-case');
const StaticSeatLayoutCatalog = require('./infrastructure/static-seat-layout-catalog');
const createSeatLayoutRouter = require('./interfaces/seat-layout-router');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const logger = require('../../shared/logger');
const createBus = require('./application/create-bus.use-case');
const createPersistBusWithPhotos = require('./application/persist-bus-with-photos');
const listBusSeats = require('./application/list-bus-seats.use-case');
const PgBusRepository = require('./infrastructure/pg-bus.repository');
const LocalBusPhotoStorage = require('./infrastructure/local-bus-photo-storage');
const createBusRouter = require('./interfaces/bus-router');

function createFleetModule({ pool, auth, env = process.env }) {
  if (env.NODE_ENV === 'production' && !env.BUS_PHOTO_STORAGE_DIR)
    throw new Error('Configura BUS_PHOTO_STORAGE_DIR para Fleet.');
  const repository = new PgBusGroupRepository(pool);
  const catalog = new StaticSeatLayoutCatalog();
  const listLayouts = listSeatLayouts({ catalog });
  const storage = new LocalBusPhotoStorage({
    root: env.BUS_PHOTO_STORAGE_DIR || path.join(os.homedir(), '.busesuta', 'fleet-photos'),
  });
  const busRepository = new PgBusRepository(pool);
  const persist = createPersistBusWithPhotos({
    repository: busRepository,
    storage,
    logger,
  });
  return {
    busRouter: createBusRouter({
      auth,
      createBus: createBus({ catalog, persist, newId: randomUUID }),
    }),
    seatLayoutRouter: createSeatLayoutRouter({ auth, listSeatLayouts: listLayouts }),
    seatLayoutQueries: { list: listLayouts },
    router: createRouter({
      createBusGroup: createBusGroup({ repository }),
      listBusGroups: listBusGroups({ repository }),
      auth,
    }),
    busGroupQueries: {
      findByCooperativeId: (cooperativeId) => repository.listByCooperative(cooperativeId),
      findById: (id, cooperativeId) => repository.findById(id, cooperativeId),
    },
    busQueries: {
      findById: (id, cooperativeId) => busRepository.findById(id, cooperativeId),
      findByCooperativeId: (cooperativeId) => busRepository.listByCooperative(cooperativeId),
      findByBusGroupId: (busGroupId, cooperativeId) =>
        busRepository.listByBusGroup(busGroupId, cooperativeId),
    },
    seatQueries: { listByBus: listBusSeats({ repository: busRepository }) },
  };
}

const inspectFleetPhotoOperation = require('./infrastructure/inspect-fleet-photo-operation');

module.exports = { createFleetModule, inspectFleetPhotoOperation };
