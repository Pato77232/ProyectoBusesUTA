const createCooperative = require('./application/create-cooperative.use-case');
const PgCooperativeRepository = require('./infrastructure/pg-cooperative.repository');
const createRouter = require('./interfaces/cooperative-router');
function createTenantsModule({ pool, auth }) {
  const repository = new PgCooperativeRepository(pool);
  return { router: createRouter({ createCooperative: createCooperative({ repository }), auth }) };
}
module.exports = { createTenantsModule };
