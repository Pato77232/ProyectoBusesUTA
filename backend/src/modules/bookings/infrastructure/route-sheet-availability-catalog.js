const { createAvailabilityRequest } = require('../domain/availability-request');
const commercialAvailabilityTrip = require('../domain/commercial-availability-trip');
const { BookingValidationError } = require('../domain/booking-error');
const BookingServiceUnavailableError = require('../domain/booking-service-unavailable-error');
module.exports = function routeSheetAvailabilityCatalog({ tripQueries }) {
  if (typeof tripQueries?.findBookableForSegment !== 'function')
    throw new TypeError('Se requiere el catálogo de viajes por tramo.');
  return Object.freeze({
    async findBookableForSegment(input) {
      const request = createAvailabilityRequest(input);
      let snapshot;
      try {
        snapshot = await tripQueries.findBookableForSegment(request);
      } catch (error) {
        if (error?.code === 'COMMERCIAL_TRIP_INVALID') throw new BookingValidationError();
        if (error?.code === 'COMMERCIAL_TRIP_SOURCE_UNAVAILABLE')
          throw new BookingServiceUnavailableError();
        throw error;
      }
      return snapshot === null ? null : commercialAvailabilityTrip(snapshot, request);
    },
  });
};
