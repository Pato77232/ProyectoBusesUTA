const BookingLifecycleError = require('./booking-lifecycle-error');
module.exports = (error, phase) =>
  Object.freeze({
    code: new BookingLifecycleError(error?.code).code,
    phase: phase === 'booking' ? 'booking' : 'batch',
  });
