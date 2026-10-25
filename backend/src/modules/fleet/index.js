const createBusGroup = require('./application/create-bus-group.use-case');
const listBusGroups = require('./application/list-bus-groups.use-case');
const PgBusGroupRepository = require('./infrastructure/pg-bus-group.repository');
const createRouter = require('./interfaces/bus-group-router');

function createFleetModule({ pool, auth }) {
  const repository = new PgBusGroupRepository(pool);
  return {
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
