const createRequestReview = require('./review-benefit-request');
const { completedReview } = require('../domain/benefit-request-review');
const { copyPurchaseInput } = require('./booking-purchase-context');
const { createPassengerManifest } = require('../domain/passenger-manifest');
const contextKey = require('../domain/benefit-review-context');
const rules = require('../domain/benefit-request');
const Failure = require('../domain/benefit-request-error');
const TEMPORARY = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  '57P01',
  '57P02',
  '57P03',
  '53300',
  '40001',
  '40P01',
  'BOOKING_TRIP_SERVICE_UNAVAILABLE',
  'COMMERCIAL_TRIP_SOURCE_UNAVAILABLE',
]);
function createBenefitRequests({
  repository,
  purchaseCatalog,
  clock,
  calendarDateAt,
  newId,
  fingerprint,
}) {
  async function protect(operation) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Failure) throw error;
      if (error?.code === 'BOOKING_VALIDATION_ERROR')
        throw new Failure('BOOKING_BENEFIT_REQUEST_INVALID');
      if (error?.code === 'BOOKING_TRIP_UNAVAILABLE') throw new Failure('BOOKING_TRIP_UNAVAILABLE');
      throw new Failure(
        TEMPORARY.has(error?.code)
          ? 'BOOKING_BENEFIT_REQUEST_UNAVAILABLE'
          : 'BOOKING_BENEFIT_REQUEST_INTEGRITY_ERROR',
      );
    }
  }
  function purchase(input) {
    const request = copyPurchaseInput(input);
    const passengers = createPassengerManifest(
      { seatIds: request.seatIds, passengers: request.passengers },
      { onDate: calendarDateAt(rules.time(clock())) },
    );
    return Object.freeze({
      ...request,
      tripId: rules.uuid(request.tripId),
      passengers,
      seatIds: Object.freeze(passengers.map((p) => p.seatId)),
    });
  }
  function replay(row, expected, identity) {
    if (!row || row.fingerprint !== expected)
      throw new Failure('BOOKING_BENEFIT_REQUEST_KEY_REUSED');
    return rules.visible(row, identity, rules.time(clock()));
  }
  return Object.freeze({
    review: createRequestReview({
      repository,
      purchaseCatalog,
      clock,
      fingerprint,
      normalizePurchase: purchase,
      protect,
    }),
    create: (input, context) =>
      protect(async () => {
        const identity = rules.actor(context, ['CUSTOMER']);
        if (
          !input ||
          typeof input !== 'object' ||
          Array.isArray(input) ||
          Object.keys(input).some(
            (k) =>
              ![
                'tripId',
                'fromPosition',
                'toPosition',
                'seatIds',
                'passengers',
                'requestKey',
              ].includes(k),
          )
        )
          throw new Failure('BOOKING_BENEFIT_REQUEST_INVALID');
        const requestKey = rules.key(input.requestKey);
        const data = { ...input };
        delete data.requestKey;
        const normalized = purchase(data);
        const hash = fingerprint(contextKey({ ...normalized, ownerId: identity.userId }));
        const prior = await repository.findByKey({ ownerId: identity.userId, requestKey });
        if (prior) return Object.freeze({ created: false, request: replay(prior, hash, identity) });
        if (!purchaseCatalog) throw new Failure('BOOKING_BENEFIT_REQUEST_UNAVAILABLE');
        const trip = await purchaseCatalog.findPurchaseContext({
          tripId: normalized.tripId,
          fromPosition: normalized.fromPosition,
          toPosition: normalized.toPosition,
        });
        if (!trip) throw new Failure('BOOKING_TRIP_UNAVAILABLE');
        const createdAt = rules.time(clock());
        const expiresAt = new Date(trip.boardingAt);
        if (
          !Number.isFinite(expiresAt.getTime()) ||
          !Array.isArray(trip.seats) ||
          trip.tripId !== normalized.tripId ||
          trip.fromPosition !== normalized.fromPosition ||
          trip.toPosition !== normalized.toPosition
        )
          throw new Failure();
        if (expiresAt <= createdAt) throw new Failure('BOOKING_TRIP_UNAVAILABLE');
        if (normalized.seatIds.some((id) => !trip.seats.some((seat) => seat.seatId === id)))
          throw new Failure('BOOKING_BENEFIT_REQUEST_INVALID');
        const fromPlace = trip.routePoints?.find(
          (p) => p.position === normalized.fromPosition,
        )?.locationKey;
        const toPlace = trip.routePoints?.find(
          (p) => p.position === normalized.toPosition,
        )?.locationKey;
        if (
          typeof fromPlace !== 'string' ||
          !fromPlace.trim() ||
          typeof toPlace !== 'string' ||
          !toPlace.trim()
        )
          throw new Failure();
        const result = await repository.save({
          id: rules.uuid(newId()),
          ownerId: identity.userId,
          cooperativeId: rules.uuid(trip.cooperativeId),
          requestKey,
          fingerprint: hash,
          purchase: normalized,
          journey: { fromPlace, toPlace },
          createdAt,
          expiresAt,
        });
        return Object.freeze({
          created: result.created,
          request: replay(result.row, hash, identity),
        });
      }),
    list: (query, context) =>
      protect(async () => {
        const identity = rules.actor(context, ['CLERK']);
        const target = rules.page(query);
        const evaluatedAt = rules.time(clock());
        const page = await repository.list({ ...target, cooperativeId: identity.cooperativeId });
        return Object.freeze({
          requests: Object.freeze(
            page.rows.map((row) => rules.visible(row, identity, evaluatedAt)),
          ),
          nextCursor: page.nextCursor,
        });
      }),
    get: (id, context) =>
      protect(async () => {
        const identity = rules.actor(context, ['CUSTOMER', 'CLERK']);
        const row = await repository.get({ id: rules.uuid(id), identity });
        const metadata = rules.visible(row, identity, rules.time(clock()));
        const completed = completedReview(row, identity);
        if (identity.role === 'CUSTOMER') return Object.freeze({ ...metadata, ...completed });
        let snapshot;
        try {
          snapshot = purchase(row.purchase);
        } catch {
          throw new Failure();
        }
        if (
          snapshot.tripId !== metadata.tripId ||
          snapshot.fromPosition !== metadata.fromPosition ||
          snapshot.toPosition !== metadata.toPosition ||
          snapshot.passengers.length !== metadata.passengerCount
        )
          throw new Failure();
        return Object.freeze({
          ...metadata,
          seatIds: snapshot.seatIds,
          passengers: snapshot.passengers,
          ...completed,
        });
      }),
  });
}
module.exports = createBenefitRequests;
