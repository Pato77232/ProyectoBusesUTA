const { createAvailabilityRequest } = require('../domain/availability-request');
const BookingTripUnavailableError = require('../domain/booking-trip-unavailable-error');
const BookingServiceUnavailableError = require('../domain/booking-service-unavailable-error');

module.exports = function getSeatMap({ seatMapCatalog }) {
  return async (input) => {
    const request = createAvailabilityRequest(input);
    if (typeof seatMapCatalog?.findSeatMap !== 'function')
      throw new BookingServiceUnavailableError();
    const seats = await seatMapCatalog.findSeatMap(request);
    if (seats === null) throw new BookingTripUnavailableError();
    return seats;
  };
};
