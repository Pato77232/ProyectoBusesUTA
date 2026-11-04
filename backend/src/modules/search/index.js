const searchTrips = require('./application/search-trips');
const createRouter = require('./interfaces/search-router');
module.exports = {
  createSearchModule: (ports) => ({ router: createRouter({ search: searchTrips(ports) }) }),
};
