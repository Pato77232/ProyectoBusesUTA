const BookingAccessError = require('../domain/booking-access-error');

// Solo recibe el contexto que auth.authenticate verificó; nunca req.body.
function createVerifiedCustomerIdentity() {
  return {
    async resolve(context) {
      const user = context?.user;
      if (
        typeof context?.sid !== 'string' ||
        !context.sid.trim() ||
        typeof user?.id !== 'string' ||
        !user.id.trim()
      )
        throw new BookingAccessError();
      if (user.role !== 'CUSTOMER' || user.cooperative_id !== null) {
        throw new BookingAccessError('FORBIDDEN');
      }
      return Object.freeze({ ownerId: user.id.trim() });
    },
  };
}
module.exports = createVerifiedCustomerIdentity;
