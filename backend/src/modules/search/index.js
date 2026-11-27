const searchTrips = require('./application/search-trips');
const listUpcoming = require('./application/list-upcoming');
const createRouter = require('./interfaces/search-router');
module.exports = {
  createSearchModule: (ports) => ({
    router: createRouter({ search: searchTrips(ports), upcoming: listUpcoming(ports) }),
  }),
};
