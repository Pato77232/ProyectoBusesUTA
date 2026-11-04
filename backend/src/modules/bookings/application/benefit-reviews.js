const { copyPurchaseInput } = require('./booking-purchase-context');
const { createPassengerManifest } = require('../domain/passenger-manifest');
const contextKey = require('../domain/benefit-review-context');
const { BookingValidationError } = require('../domain/booking-error');
const BookingAccessError = require('../domain/booking-access-error');
const BookingTripUnavailableError = require('../domain/booking-trip-unavailable-error');
const BookingPurchaseError = require('../domain/booking-purchase-error');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId = (value) => typeof value === 'string' && UUID.test(value);
function createBenefitReviews({ repository, purchaseCatalog, clock, calendarDateAt }) {
  return {
    async review(input, actor) {
      const user = actor?.user;
      if (
        !actor?.sid ||
        user?.role !== 'CLERK' ||
        !validId(user.id) ||
        !validId(user.cooperative_id)
      )
        throw new BookingAccessError('FORBIDDEN');
      const fields = [
        'ownerId',
        'tripId',
        'fromPosition',
        'toPosition',
        'seatIds',
        'passengers',
        'decisions',
      ];
      if (
        !input ||
        typeof input !== 'object' ||
        Array.isArray(input) ||
        Object.keys(input).some((key) => !fields.includes(key)) ||
        !validId(input.ownerId)
      )
        throw new BookingValidationError();
      const { ownerId, decisions, ...purchase } = input;
      const request = copyPurchaseInput(purchase);
      const now = clock();
      const passengers = createPassengerManifest(
        { seatIds: request.seatIds, passengers: request.passengers },
        { onDate: calendarDateAt(now) },
      );
      if (
        !Array.isArray(decisions) ||
        decisions.length !== passengers.length ||
        new Set(decisions.map((d) => d?.seatId)).size !== passengers.length ||
        decisions.some(
          (d) =>
            !d ||
            Object.keys(d).some(
              (key) => !['seatId', 'birthDateVerified', 'disabilityVerified'].includes(key),
            ) ||
            !passengers.some((p) => p.seatId === d.seatId) ||
            typeof d.birthDateVerified !== 'boolean' ||
            typeof d.disabilityVerified !== 'boolean',
        )
      )
        throw new BookingValidationError();
      const trip = await purchaseCatalog.findPurchaseContext({
        tripId: request.tripId,
        fromPosition: request.fromPosition,
        toPosition: request.toPosition,
      });
      if (!trip || trip.cooperativeId !== user.cooperative_id)
        throw new BookingTripUnavailableError();
      if (passengers.some((p) => !trip.seats.some((s) => s.seatId === p.seatId)))
        throw new BookingValidationError();
      const expiresAt = new Date(trip.boardingAt);
      const reviewedAt = clock();
      if (expiresAt <= reviewedAt) throw new BookingTripUnavailableError();
      await repository.append({
        cooperativeId: trip.cooperativeId,
        actorId: user.id,
        context: contextKey({ ...request, ownerId, passengers }),
        decisions,
        reviewedAt,
        expiresAt,
      });
      return Object.freeze({
        reviewedAt: reviewedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      });
    },
    async verify(input) {
      const review = await repository.findLatest({
        cooperativeId: input.cooperativeId,
        context: contextKey(input),
      });
      if (
        !review ||
        !Number.isFinite(new Date(review.expiresAt).getTime()) ||
        new Date(review.expiresAt) <= clock()
      )
        throw new BookingPurchaseError('BOOKING_BENEFIT_REVIEW_REQUIRED');
      return review.decisions;
    },
  };
}
module.exports = createBenefitReviews;
