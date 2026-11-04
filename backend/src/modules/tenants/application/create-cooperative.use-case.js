const { createCooperativeData } = require('../domain/cooperative');
const CooperativeError = require('../domain/cooperative-error');
function createCooperative({ repository }) {
  return async (input, actor) => {
    if (actor?.role !== 'SYSTEM_ADMIN') throw new CooperativeError('FORBIDDEN');
    return repository.create(createCooperativeData(input));
  };
}
module.exports = createCooperative;
module.exports.CooperativeError = CooperativeError;
