const {
  copyPurchaseInput,
  resolveOwner,
  readTrip,
  resolveSummary,
} = require('./booking-purchase-context');
const { BookingValidationError } = require('../domain/booking-error');
const BookingPurchaseError = require('../domain/booking-purchase-error');
const { createBookingDeadline } = require('../domain/booking-deadline');
const summaryRevision = require('../domain/summary-revision');

function createBooking(dependencies) {
  const { repository, proofWindowSeconds, newId } = dependencies;
  // Validar configuración al componer, sin iniciar un plazo real.
  createBookingDeadline(new Date(0), proofWindowSeconds);
  return async (input, authContext) => {
    if (
      input?.summaryAccepted !== true ||
      typeof input.acceptedSummaryRevision !== 'string' ||
      !/^[a-f0-9]{64}$/.test(input.acceptedSummaryRevision)
    ) {
      throw new BookingValidationError();
    }
    const acceptedRevision = input.acceptedSummaryRevision;
    const request = copyPurchaseInput(input, true);
    const ownerId = await resolveOwner(dependencies.buyerIdentity, authContext);
    const initialTrip = await readTrip(dependencies.tripCatalog, request.tripId);
    const scope = Object.freeze({
      tripId: initialTrip.tripId,
      cooperativeId: initialTrip.cooperativeId,
    });
    return repository.reserve(scope, async () => {
      const trip = await readTrip(dependencies.tripCatalog, request.tripId);
      if (trip.cooperativeId !== scope.cooperativeId) {
        throw new BookingPurchaseError('BOOKING_SUMMARY_CHANGED');
      }
      const { summary, context } = await resolveSummary(request, ownerId, dependencies, trip);
      if (summaryRevision(summary) !== acceptedRevision) {
        throw new BookingPurchaseError('BOOKING_SUMMARY_CHANGED');
      }
      return {
        input: Object.freeze({ ...request, summaryAccepted: true }),
        context: { ...context, ownerId, bookingId: newId(), proofWindowSeconds },
      };
    });
  };
}
module.exports = createBooking;
