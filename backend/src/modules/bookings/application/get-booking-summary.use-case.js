const {
  copyPurchaseInput,
  resolveOwner,
  readTrip,
  resolveSummary,
} = require('./booking-purchase-context');
const summaryRevision = require('../domain/summary-revision');

function getBookingSummary(dependencies) {
  return async (input, authContext) => {
    const request = copyPurchaseInput(input);
    const ownerId = await resolveOwner(dependencies.buyerIdentity, authContext);
    const trip = await readTrip(dependencies.tripCatalog, request.tripId);
    const { summary } = await resolveSummary(request, ownerId, dependencies, trip);
    return Object.freeze({ summary, summaryRevision: summaryRevision(summary) });
  };
}
module.exports = getBookingSummary;
