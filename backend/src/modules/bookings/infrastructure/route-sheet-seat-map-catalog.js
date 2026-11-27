const { createAvailabilityRequest } = require('../domain/availability-request');
const commercialAvailabilityTrip = require('../domain/commercial-availability-trip');
const { createSeatMap } = require('../domain/seat-map');
const { BookingValidationError } = require('../domain/booking-error');
const BookingServiceUnavailableError = require('../domain/booking-service-unavailable-error');

// Lee la copia publicada que Route Sheets ya entrega para la compra; no la modifica.
module.exports = function routeSheetSeatMapCatalog({ tripQueries }) {
  if (typeof tripQueries?.findPurchaseContext !== 'function')
    throw new TypeError('Se requiere el contrato comercial de compra por tramo.');
  return Object.freeze({
    async findSeatMap(input) {
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
      if (source === null) return null;
      const trip = commercialAvailabilityTrip(source, request);
      return createSeatMap({ seats: source.seats, seatIds: trip.seatIds });
    },
  });
};
