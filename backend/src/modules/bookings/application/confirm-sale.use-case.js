const { request } = require('../domain/booking-lifecycle');
const { verifySaleIntent, recoverSaleResult } = require('../domain/booking-sale-attempt');
const BookingSaleError = require('../domain/booking-sale-error');
const BookingLifecycleError = require('../domain/booking-lifecycle-error');

function confirmSale({ repository, approvalSource, clock }) {
  if (
    typeof repository?.confirmSale !== 'function' ||
    typeof approvalSource !== 'function' ||
    typeof clock !== 'function'
  )
    throw new TypeError(
      'Se requiere una fuente interna de intención versionada y persistencia de venta.',
    );

  return async (input) => {
    const target = request(input);
    let source;
    try {
      source = await approvalSource(target);
    } catch {
      throw new BookingSaleError('BOOKING_SALE_UNAVAILABLE');
    }
    if (source === null) throw new BookingSaleError('BOOKING_SALE_UNAVAILABLE');
    const attempt = verifySaleIntent(target, source);
    try {
      const stored = await repository.confirmSale(attempt, clock);
      if (stored === null) throw new BookingSaleError('BOOKING_SALE_UNAVAILABLE');
      return recoverSaleResult(attempt, stored);
    } catch (error) {
      if (error instanceof BookingSaleError) throw error;
      if (error instanceof BookingLifecycleError && error.code === 'BOOKING_NOT_FOUND')
        throw new BookingSaleError('BOOKING_SALE_NOT_CONFIRMABLE');
      if (error instanceof BookingLifecycleError && error.code === 'BOOKING_DATA_INTEGRITY_ERROR')
        throw new BookingSaleError();
      throw new BookingSaleError('BOOKING_SALE_UNAVAILABLE');
    }
  };
}
module.exports = confirmSale;
