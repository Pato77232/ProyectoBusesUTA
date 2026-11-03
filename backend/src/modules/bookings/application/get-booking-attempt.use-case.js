const { validateRequestKey } = require('../domain/booking-creation-request');
const { resolveOwner } = require('./booking-purchase-context');
const BookingAttemptNotFoundError = require('../domain/booking-attempt-not-found-error');

function getBookingAttempt({ buyerIdentity, repository }) {
  return async (requestKey, authContext) => {
    const key = validateRequestKey(requestKey);
    const ownerId = await resolveOwner(buyerIdentity, authContext);
    const booking = await repository.findByCreationRequest({ ownerId, requestKey: key });
    if (booking === null) throw new BookingAttemptNotFoundError();
    return booking;
  };
}
module.exports = getBookingAttempt;
