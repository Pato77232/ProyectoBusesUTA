const {
  createAvailabilityRequest,
  createAvailabilityTrip,
} = require('../domain/availability-request');
const { BookingValidationError } = require('../domain/booking-error');
const BookingTripUnavailableError = require('../domain/booking-trip-unavailable-error');
const BookingServiceUnavailableError = require('../domain/booking-service-unavailable-error');
const { listSeatAvailability } = require('../domain/seat-availability');

function getSeatAvailability({ tripCatalog, allocationReader }) {
  return async (input) => {
    const request = createAvailabilityRequest(input);
    let foundTrip;
    try {
      foundTrip =
        typeof tripCatalog.findBookableForSegment === 'function'
          ? await tripCatalog.findBookableForSegment(request)
          : await tripCatalog.findBookableById(request.tripId);
    } catch (error) {
      if (
        error?.code === 'COMMERCIAL_TRIP_SOURCE_UNAVAILABLE' ||
        error?.code === 'COMMERCIAL_TRIP_INVALID'
      )
        throw new BookingServiceUnavailableError();
      throw error;
    }
    if (foundTrip === null) throw new BookingTripUnavailableError();
    const trip = createAvailabilityTrip(foundTrip, request.tripId);
    if (request.toPosition >= trip.routePointCount) throw new BookingValidationError();

    const context = Object.freeze({ tripId: trip.tripId, cooperativeId: trip.cooperativeId });
    const allocations = await allocationReader.listEffectiveByTrip(context);
    return listSeatAvailability({
      query: { ...request, cooperativeId: trip.cooperativeId },
      seatIds: trip.seatIds,
      allocations,
    });
  };
}

module.exports = getSeatAvailability;
