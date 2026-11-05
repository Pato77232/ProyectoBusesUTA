const {
  createAvailabilityRequest,
  createAvailabilityTrip,
} = require('../domain/availability-request');
const { createPassengerManifest } = require('../domain/passenger-manifest');
const { createBookingSummary } = require('../domain/booking-summary');
const { BookingValidationError } = require('../domain/booking-error');
const BookingPurchaseError = require('../domain/booking-purchase-error');
const BookingTripUnavailableError = require('../domain/booking-trip-unavailable-error');
const BookingServiceUnavailableError = require('../domain/booking-service-unavailable-error');

const INPUT_FIELDS = ['tripId', 'fromPosition', 'toPosition', 'seatIds', 'passengers'];
const PASSENGER_FIELDS = ['seatId', 'identificationNumber', 'fullName', 'birthDate'];

function copyPurchaseInput(input, acceptance = false) {
  const fields = acceptance
    ? [...INPUT_FIELDS, 'summaryAccepted', 'acceptedSummaryRevision', 'requestKey']
    : INPUT_FIELDS;
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !fields.includes(key)) ||
    !Array.isArray(input.seatIds) ||
    !Array.isArray(input.passengers) ||
    input.seatIds.some((seat) => typeof seat !== 'string')
  )
    throw new BookingValidationError();
  const request = createAvailabilityRequest({
    tripId: input.tripId,
    fromPosition: input.fromPosition,
    toPosition: input.toPosition,
  });
  const passengers = input.passengers.map((passenger) => {
    if (
      !passenger ||
      typeof passenger !== 'object' ||
      Array.isArray(passenger) ||
      Object.keys(passenger).some((key) => !PASSENGER_FIELDS.includes(key)) ||
      PASSENGER_FIELDS.some((key) => typeof passenger[key] !== 'string')
    ) {
      throw new BookingValidationError();
    }
    return Object.freeze({ ...passenger });
  });
  return Object.freeze({
    ...request,
    seatIds: Object.freeze([...input.seatIds]),
    passengers: Object.freeze(passengers),
  });
}

async function resolveBuyer(buyerIdentity, authContext) {
  const identity = await buyerIdentity.resolve(authContext);
  if (typeof identity?.ownerId !== 'string' || !identity.ownerId.trim()) {
    throw new BookingValidationError();
  }
  return Object.freeze({
    ownerId: identity.ownerId.trim(),
    contactEmail: identity.contactEmail ?? null,
  });
}

async function resolveOwner(buyerIdentity, authContext) {
  return (await resolveBuyer(buyerIdentity, authContext)).ownerId;
}

async function readTrip(tripCatalog, request, tariffQueries) {
  const { tripId, fromPosition, toPosition } = request;
  let found;
  try {
    found =
      typeof tripCatalog.findBookableForSegment === 'function'
        ? await tripCatalog.findBookableForSegment({ tripId, fromPosition, toPosition })
        : await tripCatalog.findBookableById(tripId);
  } catch (error) {
    if (
      error?.code === 'COMMERCIAL_TRIP_SOURCE_UNAVAILABLE' ||
      error?.code === 'COMMERCIAL_TRIP_INVALID'
    )
      throw new BookingServiceUnavailableError();
    throw error;
  }
  if (found === null) throw new BookingTripUnavailableError();
  const availabilityTrip = createAvailabilityTrip(found, tripId);
  if (!Array.isArray(found.segmentPricesCents) && typeof tariffQueries?.findPrice !== 'function')
    throw new BookingValidationError();
  const trip = {
    ...availabilityTrip,
    departureDate: found.departureDate,
    segmentPricesCents: Array.isArray(found.segmentPricesCents)
      ? Object.freeze([...found.segmentPricesCents])
      : undefined,
  };
  if (typeof tariffQueries?.findPrice === 'function') {
    let price;
    try {
      price = await tariffQueries.findPrice({
        routeSheetId: found.routeSheetId,
        cooperativeId: found.cooperativeId,
        frequencyId: found.frequencyId,
        fromPosition,
        toPosition,
      });
    } catch (error) {
      if (error?.code === 'TARIFF_SOURCE_UNAVAILABLE') throw new BookingServiceUnavailableError();
      throw error;
    }
    if (price) {
      trip.publishedPriceCents = price.amountCents;
      trip.tariffPolicy = price.policy;
      trip.tariffRevision = price.revision;
    }
  }
  return Object.freeze(trip);
}

async function readPurchaseTrip(dependencies, request) {
  if (!dependencies.purchaseCatalog)
    return readTrip(dependencies.tripCatalog, request, dependencies.tariffQueries);
  const trip = await dependencies.purchaseCatalog.findPurchaseContext({
    tripId: request.tripId,
    fromPosition: request.fromPosition,
    toPosition: request.toPosition,
  });
  if (trip === null) throw new BookingTripUnavailableError();
  return Object.freeze({
    ...trip,
    commercial: true,
    departureDate: dependencies.calendarDateAt(new Date(trip.boardingAt)),
  });
}

function serverTime({ clock, calendarDateAt }) {
  const value = clock();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new BookingValidationError();
  }
  const startedAt = new Date(value.getTime());
  return { startedAt, onDate: calendarDateAt(new Date(startedAt.getTime())) };
}

function verifiedBenefits(entries, preliminary) {
  if (!Array.isArray(entries) || entries.length !== preliminary.passengers.length) {
    throw new BookingValidationError();
  }
  const bySeat = new Map();
  for (const entry of entries) {
    if (
      !entry ||
      typeof entry.seatId !== 'string' ||
      bySeat.has(entry.seatId) ||
      typeof entry.birthDateVerified !== 'boolean' ||
      typeof entry.disabilityVerified !== 'boolean'
    )
      throw new BookingValidationError();
    bySeat.set(entry.seatId, entry);
  }
  return Object.freeze(
    preliminary.passengers.map((passenger) => {
      const verified = bySeat.get(passenger.seatId);
      if (!verified) throw new BookingValidationError();
      const ageDiscount = passenger.quote.eligibleCategories.some((category) =>
        ['MINOR', 'SENIOR'].includes(category),
      );
      if ((ageDiscount || preliminary.schemaVersion === 2) && !verified.birthDateVerified) {
        throw new BookingPurchaseError('BOOKING_BENEFIT_REVIEW_REQUIRED');
      }
      return Object.freeze({
        seatId: passenger.seatId,
        disabilityVerified: verified.disabilityVerified,
      });
    }),
  );
}

async function resolveSummary(request, ownerId, dependencies, trip) {
  const time = serverTime(dependencies);
  const passengers = createPassengerManifest(
    { seatIds: request.seatIds, passengers: request.passengers },
    time,
  );
  const preliminary = createBookingSummary(request, {
    ...time,
    trip,
    passengerBenefits: passengers.map(({ seatId }) => ({ seatId, disabilityVerified: false })),
  });
  const verification = await dependencies.passengerVerifier.verify(
    Object.freeze({
      ownerId,
      passengers,
      departureDate: trip.departureDate,
      ...(trip.commercial
        ? {
            tripId: trip.tripId,
            cooperativeId: trip.cooperativeId,
            fromPosition: request.fromPosition,
            toPosition: request.toPosition,
          }
        : {}),
    }),
  );
  const passengerBenefits = verifiedBenefits(verification, preliminary);
  const currentTrip = trip.commercial ? await readPurchaseTrip(dependencies, request) : trip;
  const context = { ...serverTime(dependencies), trip: currentTrip, passengerBenefits };
  return { summary: createBookingSummary(request, context), context };
}

module.exports = {
  copyPurchaseInput,
  resolveBuyer,
  resolveOwner,
  readTrip,
  readPurchaseTrip,
  resolveSummary,
};
