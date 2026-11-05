const rules = require('../domain/benefit-request');
const {
  reviewInput,
  proofDecisions,
  completedReview,
} = require('../domain/benefit-request-review');
const contextKey = require('../domain/benefit-review-context');
const Failure = require('../domain/benefit-request-error');
module.exports = function createReview({
  repository,
  purchaseCatalog,
  clock,
  fingerprint,
  normalizePurchase,
  protect,
}) {
  return (id, input, context) =>
    protect(async () => {
      const identity = rules.actor(context, ['CLERK']);
      const requestId = rules.uuid(id);
      const command = reviewInput(input);
      const intent = fingerprint(
        JSON.stringify([requestId, identity.userId, identity.cooperativeId, command]),
      );
      const observed = await repository.get({ id: requestId, identity });
      rules.visible(observed, identity, rules.time(clock()));
      let purchase;
      let canonical;
      if (observed.status !== 'REVIEWED') {
        if (observed.revision !== command.expectedRevision)
          throw new Failure('BOOKING_BENEFIT_REVIEW_CONFLICT');
        try {
          purchase = normalizePurchase(observed.purchase);
        } catch {
          throw new Failure();
        }
        canonical = contextKey({ ...purchase, ownerId: observed.ownerId });
        if (
          fingerprint(canonical) !== observed.fingerprint ||
          purchase.tripId !== observed.tripId ||
          purchase.fromPosition !== Number(observed.fromPosition) ||
          purchase.toPosition !== Number(observed.toPosition)
        )
          throw new Failure();
        if (
          purchase.passengers.length !== command.decisions.length ||
          command.decisions.some((d) => !purchase.passengers.some((p) => p.seatId === d.seatId))
        )
          throw new Failure('BOOKING_BENEFIT_REQUEST_INVALID');
        if (!purchaseCatalog) throw new Failure('BOOKING_BENEFIT_REQUEST_UNAVAILABLE');
        const trip = await purchaseCatalog.findPurchaseContext({
          tripId: purchase.tripId,
          fromPosition: purchase.fromPosition,
          toPosition: purchase.toPosition,
        });
        if (
          !trip ||
          trip.tripId !== purchase.tripId ||
          trip.cooperativeId !== identity.cooperativeId ||
          trip.fromPosition !== purchase.fromPosition ||
          trip.toPosition !== purchase.toPosition ||
          new Date(trip.boardingAt).getTime() !== new Date(observed.expiresAt).getTime() ||
          !Array.isArray(trip.seats) ||
          purchase.seatIds.some((id) => !trip.seats.some((s) => s.seatId === id))
        )
          throw new Failure('BOOKING_TRIP_UNAVAILABLE');
      }
      return repository.withLockedRequest(
        { id: requestId, cooperativeId: identity.cooperativeId },
        async (row, tx) => {
          const now = rules.time(clock());
          rules.visible(row, identity, now);
          if (row.status === 'REVIEWED') {
            if (
              row.reviewFingerprint !== intent ||
              row.reviewedBy !== identity.userId ||
              row.reviewExpectedRevision !== command.expectedRevision
            )
              throw new Failure('BOOKING_BENEFIT_REVIEW_CONFLICT');
            return Object.freeze({
              ...rules.visible(row, identity, now),
              ...completedReview(row, identity),
            });
          }
          if (row.revision !== command.expectedRevision || row.fingerprint !== observed.fingerprint)
            throw new Failure('BOOKING_BENEFIT_REVIEW_CONFLICT');
          if (!canonical || now.getTime() >= new Date(row.expiresAt).getTime())
            throw new Failure('BOOKING_TRIP_UNAVAILABLE');
          const saved = await tx.complete({
            actorId: identity.userId,
            expectedRevision: command.expectedRevision,
            intent,
            decisions: command.decisions,
            proofDecisions: proofDecisions(command.decisions),
            context: canonical,
            reviewedAt: now,
          });
          return Object.freeze({
            ...rules.visible(saved, identity, now),
            ...completedReview(saved, identity),
          });
        },
      );
    });
};
