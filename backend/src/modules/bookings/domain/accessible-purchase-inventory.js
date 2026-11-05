const BookingTripIntegrityError = require('./booking-trip-integrity-error');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
module.exports = function accessiblePurchaseInventory(source) {
  if (source.accessibleInventoryVersion === undefined) {
    if (source.accessibleSpaces !== undefined) throw new BookingTripIntegrityError();
    return Object.freeze([]);
  }
  if (source.accessibleInventoryVersion !== 2 || !Array.isArray(source.accessibleSpaces))
    throw new BookingTripIntegrityError();
  const ids = new Set(source.seatIds.map((id) => id.toLowerCase()));
  return Object.freeze(
    source.accessibleSpaces.map((space) => {
      if (
        !space ||
        typeof space.seatId !== 'string' ||
        !UUID.test(space.seatId) ||
        space.seatId !== space.seatId.toLowerCase() ||
        ids.has(space.seatId.toLowerCase()) ||
        space.category !== 'ACCESSIBLE' ||
        space.offered !== false ||
        space.reservable !== true
      )
        throw new BookingTripIntegrityError();
      ids.add(space.seatId);
      return Object.freeze({ seatId: space.seatId, category: 'ACCESSIBLE' });
    }),
  );
};
