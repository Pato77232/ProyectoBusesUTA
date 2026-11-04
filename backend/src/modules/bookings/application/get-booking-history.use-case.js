const BookingAttemptNotFoundError = require('../domain/booking-attempt-not-found-error');

function ownerId(authContext) {
  const id = authContext?.user?.id ?? authContext?.userId;
  if (typeof id !== 'string' || !id.trim()) throw new BookingAttemptNotFoundError();
  return id.trim();
}

function getBookingHistory({ repository }) {
  return {
    list: (query, authContext) =>
      repository.listByOwner({
        ownerId: ownerId(authContext),
        cursor: query?.cursor,
        limit: query?.limit === undefined ? 20 : Number(query.limit),
      }),
    get: async (bookingId, authContext) => {
      const booking = await repository.findByOwner({ bookingId, ownerId: ownerId(authContext) });
      if (!booking) throw new BookingAttemptNotFoundError();
      return booking;
    },
  };
}

module.exports = getBookingHistory;
