// Errores públicos de los casos de uso para la capa de transporte.
module.exports = {
  BookingTripIntegrityError: require('../domain/booking-trip-integrity-error'),
  ...require('../domain/booking-error'),
  BookingAttemptNotFoundError: require('../domain/booking-attempt-not-found-error'),
  BookingAccessError: require('../domain/booking-access-error'),
  BookingConflictError: require('../domain/booking-conflict-error'),
  BookingPurchaseError: require('../domain/booking-purchase-error'),
  BookingTripUnavailableError: require('../domain/booking-trip-unavailable-error'),
  BookingServiceUnavailableError: require('../domain/booking-service-unavailable-error'),
};
