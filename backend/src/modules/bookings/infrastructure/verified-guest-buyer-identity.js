const BookingAccessError = require('../domain/booking-access-error');

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const EMAIL = /^[^\s<>@,;]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

/** El secreto llega de una cookie del servidor cuando exista la ruta; nunca del body. */
function createVerifiedGuestBuyerIdentity(guestEmailAccess) {
  if (typeof guestEmailAccess?.verify !== 'function')
    throw new TypeError('Falta el verificador de invitado.');
  return Object.freeze({
    async resolve(context) {
      if (typeof context?.guestSessionToken !== 'string') throw new BookingAccessError();
      let grant;
      try {
        grant = await guestEmailAccess.verify(context.guestSessionToken);
      } catch (error) {
        if (error?.code === 'GUEST_ACCESS_INVALID') throw new BookingAccessError();
        throw error;
      }
      if (
        grant?.principalType !== 'GUEST_BUYER' ||
        !UUID.test(grant.guestBuyerId) ||
        typeof grant.email !== 'string' ||
        grant.email.length > 254 ||
        grant.email !== grant.email.trim().toLowerCase() ||
        !EMAIL.test(grant.email)
      )
        throw new BookingAccessError();
      return Object.freeze({
        ownerId: `guest:${grant.guestBuyerId.toLowerCase()}`,
        contactEmail: grant.email,
      });
    },
  });
}

module.exports = createVerifiedGuestBuyerIdentity;
