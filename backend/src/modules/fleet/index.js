const createBusGroup = require('./application/create-bus-group.use-case');
const listBusGroups = require('./application/list-bus-groups.use-case');
const PgBusGroupRepository = require('./infrastructure/pg-bus-group.repository');
const createRouter = require('./interfaces/bus-group-router');
const listSeatLayouts = require('./application/list-seat-layouts.use-case');
const StaticSeatLayoutCatalog = require('./infrastructure/static-seat-layout-catalog');
const createSeatLayoutRouter = require('./interfaces/seat-layout-router');

function createFleetModule({ pool, auth }) {
  const repository = new PgBusGroupRepository(pool);
  const listLayouts = listSeatLayouts({ catalog: new StaticSeatLayoutCatalog() });
  return {
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
  };
}

module.exports = { createFleetModule };
