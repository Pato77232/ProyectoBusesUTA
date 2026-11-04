const { BookingValidationError } = require('./booking-error');
const { createAvailabilityRequest, createAvailabilityTrip } = require('./availability-request');
const { createPassengerManifest } = require('./passenger-manifest');
const { quotePassenger, ageOnDate } = require('./passenger-quote');
const commercialBookingSummary = require('./commercial-booking-summary');

const INPUT_FIELDS = Object.freeze([
  'tripId',
  'fromPosition',
  'toPosition',
  'seatIds',
  'passengers',
]);
const TOTAL_FIELDS = Object.freeze(['basePriceCents', 'discountCents', 'totalPriceCents']);

function selectedPrices(trip, request) {
  if (
    !Array.isArray(trip.segmentPricesCents) ||
    trip.segmentPricesCents.length !== trip.routePointCount - 1
  ) {
    throw new BookingValidationError();
  }
  for (const price of trip.segmentPricesCents) {
    if (!Number.isSafeInteger(price) || price <= 0) throw new BookingValidationError();
  }
  return trip.segmentPricesCents.slice(request.fromPosition, request.toPosition);
}

function benefitsForPassengers(entries, passengers) {
  if (!Array.isArray(entries) || entries.length !== passengers.length)
    throw new BookingValidationError();
  const selectedSeats = new Set(passengers.map((passenger) => passenger.seatId));
  const benefits = new Map();
  for (const entry of entries) {
    if (
      !entry ||
      !selectedSeats.has(entry.seatId) ||
      benefits.has(entry.seatId) ||
      typeof entry.disabilityVerified !== 'boolean'
    )
      throw new BookingValidationError();
    benefits.set(entry.seatId, entry.disabilityVerified);
  }
  return benefits;
}

function sumQuotes(passengers) {
  const totals = { basePriceCents: 0, discountCents: 0, totalPriceCents: 0 };
  for (const passenger of passengers) {
    for (const field of TOTAL_FIELDS) {
      const sum = totals[field] + passenger.quote[field];
      if (!Number.isSafeInteger(sum)) throw new BookingValidationError();
      totals[field] = sum;
    }
  }
  return Object.freeze(totals);
}

// Función interna: el contexto debe ser resuelto por el servidor, no por el navegador.
function createBookingSummary(input, context) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((field) => !INPUT_FIELDS.includes(field))
  )
    throw new BookingValidationError();
  const request = createAvailabilityRequest({
    tripId: input.tripId,
    fromPosition: input.fromPosition,
    toPosition: input.toPosition,
  });
  const trip = createAvailabilityTrip(context?.trip, request.tripId);
  if (request.toPosition >= trip.routePointCount) throw new BookingValidationError();
  const manifest = createPassengerManifest(
    { seatIds: input.seatIds, passengers: input.passengers },
    context,
  );
  const inventory = new Set(trip.seatIds);
  if (manifest.some((passenger) => !inventory.has(passenger.seatId)))
    throw new BookingValidationError();
  if (context.trip.commercial === true) return commercialBookingSummary(request, manifest, context);
  const departureDate = context.trip.departureDate;
  ageOnDate(context.onDate, departureDate);
  const prices = selectedPrices(context.trip, request);
  const benefits = benefitsForPassengers(context.passengerBenefits, manifest);
  const passengers = Object.freeze(
    manifest.map((passenger) =>
      Object.freeze({
        ...passenger,
        quote: quotePassenger({
          segmentPricesCents: prices,
          birthDate: passenger.birthDate,
          departureDate,
          disabilityVerified: benefits.get(passenger.seatId),
        }),
      }),
    ),
  );
  return Object.freeze({
    ...request,
    cooperativeId: trip.cooperativeId,
    departureDate,
    currency: 'USD',
    passengers,
    totals: sumQuotes(passengers),
  });
}

module.exports = { createBookingSummary };
