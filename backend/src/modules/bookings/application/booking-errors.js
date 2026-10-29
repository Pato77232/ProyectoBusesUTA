// Errores públicos de los casos de uso para la capa de transporte.
module.exports = {
  ...require('../domain/booking-error'),
  BookingAccessError: require('../domain/booking-access-error'),
  BookingConflictError: require('../domain/booking-conflict-error'),
  BookingPurchaseError: require('../domain/booking-purchase-error'),
  BookingTripUnavailableError: require('../domain/booking-trip-unavailable-error'),
  BookingServiceUnavailableError: require('../domain/booking-service-unavailable-error'),
};
