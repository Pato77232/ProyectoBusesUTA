const { createAvailabilityRequest } = require('../domain/availability-request');
const { listSeatAvailability } = require('../domain/seat-availability');
const BookingTripUnavailableError = require('../domain/booking-trip-unavailable-error');
const BookingServiceUnavailableError = require('../domain/booking-service-unavailable-error');
module.exports = function getAccessibleAvailability({ purchaseCatalog, allocationReader }) {
  return async (input) => {
    const request = createAvailabilityRequest(input);
    if (!purchaseCatalog) throw new BookingServiceUnavailableError();
    const trip = await purchaseCatalog.findPurchaseContext(request);
    if (!trip) throw new BookingTripUnavailableError();
    const spaces = trip.seats.filter((seat) => seat.category === 'ACCESSIBLE');
    if (!spaces.length) return Object.freeze([]);
    const allocations = await allocationReader.listEffectiveByTrip({
      tripId: trip.tripId,
      cooperativeId: trip.cooperativeId,
    });
    return Object.freeze(
      listSeatAvailability({
        query: { ...request, cooperativeId: trip.cooperativeId },
        seatIds: spaces.map((space) => space.seatId),
        allocations,
      }).map((space) => Object.freeze({ ...space, category: 'ACCESSIBLE' })),
    );
  };
};
