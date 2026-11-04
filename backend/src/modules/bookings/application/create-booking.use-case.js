const {
  copyPurchaseInput,
  resolveOwner,
  readPurchaseTrip,
  resolveSummary,
} = require('./booking-purchase-context');
const { BookingValidationError } = require('../domain/booking-error');
const BookingPurchaseError = require('../domain/booking-purchase-error');
const { createBookingDeadline } = require('../domain/booking-deadline');
const summaryRevision = require('../domain/summary-revision');
const {
  validateRequestKey,
  bookingCreationFingerprint,
  createBookingOperation,
} = require('../domain/booking-creation-request');

function createBooking(dependencies) {
  const { repository, proofWindowSeconds, newId } = dependencies;
  // Validar configuración al componer, sin iniciar un plazo real.
  createBookingDeadline(new Date(0), proofWindowSeconds);
  return async (input, authContext) => {
    if (
      input?.summaryAccepted !== true ||
      typeof input.acceptedSummaryRevision !== 'string' ||
      !/^[a-f0-9]{64}$/.test(input.acceptedSummaryRevision)
    )
      throw new BookingValidationError();
    const acceptedRevision = input.acceptedSummaryRevision;
    const request = copyPurchaseInput(input, true);
    const requestKey = Object.hasOwn(input, 'requestKey')
      ? validateRequestKey(input.requestKey)
      : null;
    const requestFingerprint = requestKey
      ? bookingCreationFingerprint(request, acceptedRevision)
      : null;
    const ownerId = await resolveOwner(dependencies.buyerIdentity, authContext);

    const locate = async () => {
      const trip = await readPurchaseTrip(dependencies, request);
      return Object.freeze({ tripId: trip.tripId, cooperativeId: trip.cooperativeId });
    };
    const prepare = async (scope) => {
      const trip = await readPurchaseTrip(dependencies, request);
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
    };
    if (requestKey) {
      return repository.reserveOnce(
        createBookingOperation({ ownerId, requestKey, requestFingerprint }),
        locate,
        prepare,
      );
    }
    const scope = await locate();
    return repository.reserve(scope, () => prepare(scope));
  };
}
module.exports = createBooking;
