const accessibleInventory = require('../domain/accessible-purchase-inventory');
const { createAvailabilityRequest } = require('../domain/availability-request');
const validateTrip = require('../domain/commercial-availability-trip');
const BookingTripIntegrityError = require('../domain/booking-trip-integrity-error');
const BookingServiceUnavailableError = require('../domain/booking-service-unavailable-error');
const { BookingValidationError } = require('../domain/booking-error');
const MAX_BASE_PRICE_CENTS = 9_999_999_999;
const MAX_BASIS_POINTS = 10000;

const POLICY_FIELDS = [
  'vipSurchargeBps',
  'minorDiscountBps',
  'seniorDiscountBps',
  'disabilityDiscountBps',
];
const SOURCE_FIELDS = [
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
  'confirmedThroughExclusive',
];

function purchaseTrip(source, request) {
  const trip = validateTrip(source, request);
  if (
    source.currency !== 'USD' ||
    !Number.isSafeInteger(source.amountCents) ||
    source.amountCents <= 0 ||
    source.amountCents > MAX_BASE_PRICE_CENTS ||
    source.policy?.discountStrategy !== 'MAX_ELIGIBLE' ||
    POLICY_FIELDS.some(
      (field) =>
        !Number.isInteger(source.policy[field]) ||
        source.policy[field] < 0 ||
        source.policy[field] > MAX_BASIS_POINTS,
    ) ||
    !Array.isArray(source.seats) ||
    source.seats.length !== trip.seatIds.length
  ) {
    throw new BookingTripIntegrityError();
  }
  const categories = new Map();
  for (const seat of source.seats) {
    if (
      !seat ||
      !trip.seatIds.includes(seat.seatId) ||
      categories.has(seat.seatId) ||
      seat.offered !== true ||
      !['NORMAL', 'VIP'].includes(seat.category)
    ) {
      throw new BookingTripIntegrityError();
    }
    categories.set(seat.seatId, seat.category);
  }
  const accessibleSpaces = accessibleInventory(source);
  return Object.freeze({
    ...trip,
    ...request,
    ...Object.fromEntries(SOURCE_FIELDS.map((field) => [field, source[field]])),
    seatIds: Object.freeze([...trip.seatIds, ...accessibleSpaces.map((space) => space.seatId)]),
    ...(source.accessibleInventoryVersion === 2 ? { accessibleInventoryVersion: 2 } : {}),
    currency: 'USD',
    amountCents: source.amountCents,
    policy: Object.freeze(
      Object.fromEntries(
        ['discountStrategy', ...POLICY_FIELDS].map((key) => [key, source.policy[key]]),
      ),
    ),
    seats: Object.freeze([
      ...trip.seatIds.map((seatId) => Object.freeze({ seatId, category: categories.get(seatId) })),
      ...accessibleSpaces,
    ]),
    routePoints: Object.freeze(source.routePoints.map((point) => Object.freeze({ ...point }))),
  });
}

module.exports = function routeSheetPurchaseCatalog({ tripQueries }) {
  if (typeof tripQueries?.findPurchaseContext !== 'function') {
    throw new TypeError('Se requiere el contrato comercial de compra por tramo.');
  }
  return Object.freeze({
    async findPurchaseContext(input) {
      const request = createAvailabilityRequest(input);
      let source;
      try {
        source = await tripQueries.findPurchaseContext(request);
      } catch (error) {
        if (error?.code === 'COMMERCIAL_TRIP_INVALID') throw new BookingValidationError();
        if (error?.code === 'COMMERCIAL_TRIP_SOURCE_UNAVAILABLE')
          throw new BookingServiceUnavailableError();
        throw error;
      }
      return source === null ? null : purchaseTrip(source, request);
    },
  });
};
