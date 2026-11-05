const { validatePassengerContact } = require('./passenger-contact');
const quote = require('./commercial-passenger-quote');
const { BookingValidationError } = require('./booking-error');
const TOTAL_FIELDS = [
  'basePriceCents',
  'vipSurchargeCents',
  'discountCents',
  'roundingAdjustmentCents',
  'totalPriceCents',
];
const REFERENCE_FIELDS = [
  'routeSheetId',
  'assignmentId',
  'requiredServiceId',
  'frequencyId',
  'busId',
  'programmingRevision',
  'tariffRevision',
  'inventorySnapshotId',
  'inventoryRevision',
  'boardingAt',
];

module.exports = function commercialBookingSummary(request, manifest, context) {
  const { trip, passengerBenefits } = context;
  if (
    trip.fromPosition !== request.fromPosition ||
    trip.toPosition !== request.toPosition ||
    !Array.isArray(passengerBenefits) ||
    passengerBenefits.length !== manifest.length
  )
    throw new BookingValidationError();
  const benefits = new Map();
  for (const benefit of passengerBenefits) {
    if (
      !benefit ||
      benefits.has(benefit.seatId) ||
      !manifest.some((p) => p.seatId === benefit.seatId) ||
      typeof benefit.disabilityVerified !== 'boolean'
    )
      throw new BookingValidationError();
    benefits.set(benefit.seatId, benefit.disabilityVerified);
  }
  manifest.forEach((passenger) => validatePassengerContact(passenger, trip.departureDate));
  const passengers = Object.freeze(
    manifest.map((passenger) => {
      const seat = trip.seats.find((candidate) => candidate.seatId === passenger.seatId);
      if (!seat) throw new BookingValidationError();
      return Object.freeze({
        ...passenger,
        seatCategory: seat.category,
        quote: quote({
          amountCents: trip.amountCents,
          policy: trip.policy,
          category: seat.category,
          birthDate: passenger.birthDate,
          departureDate: trip.departureDate,
          disabilityVerified: benefits.get(passenger.seatId),
        }),
      });
    }),
  );
  const totals = Object.fromEntries(TOTAL_FIELDS.map((key) => [key, 0]));
  for (const passenger of passengers)
    for (const field of TOTAL_FIELDS) {
      totals[field] += passenger.quote[field];
      if (!Number.isSafeInteger(totals[field])) throw new BookingValidationError();
    }
  return Object.freeze({
    ...request,
    schemaVersion: 2,
    cooperativeId: trip.cooperativeId,
    departureDate: trip.departureDate,
    currency: 'USD',
    passengers,
    totals: Object.freeze(totals),
    commercial: Object.freeze({
      ...Object.fromEntries(REFERENCE_FIELDS.map((key) => [key, trip[key]])),
      ...(trip.accessibleInventoryVersion === 2 ? { accessibleInventoryVersion: 2 } : {}),
      unitPriceCents: trip.amountCents,
      policy: trip.policy,
      routePoints: trip.routePoints,
    }),
  });
};
