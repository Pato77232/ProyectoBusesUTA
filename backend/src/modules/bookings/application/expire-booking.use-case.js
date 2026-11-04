const { request } = require('../domain/booking-lifecycle');
module.exports =
  ({ repository, clock }) =>
  async (input) =>
    repository.expire(request(input, false), clock);
