const BookingTripIntegrityError = require('./booking-trip-integrity-error');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (value) => typeof value === 'string' && UUID.test(value);
const fail = () => {
  throw new BookingTripIntegrityError();
};
function instant(value) {
  const parts =
    typeof value === 'string' &&
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts) return false;
  const [, date, hour, minute, second = '00', fraction = '', zone] = parts;
  const local = new Date(`${date}T${hour}:${minute}:${second}${fraction}Z`);
  return (
    Number.isFinite(Date.parse(value)) &&
    Number.isFinite(local.getTime()) &&
    local.toISOString().slice(0, 19) === `${date}T${hour}:${minute}:${second}` &&
    (zone === 'Z' || (Number(zone.slice(1, 3)) <= 23 && Number(zone.slice(4, 6)) <= 59))
  );
}
module.exports = function commercialAvailabilityTrip(value, request) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    value.tripId !== request.tripId ||
    value.fromPosition !== request.fromPosition ||
    value.toPosition !== request.toPosition ||
    ![
      'tripId',
      'cooperativeId',
      'routeSheetId',
      'assignmentId',
      'requiredServiceId',
      'frequencyId',
      'busId',
      'inventorySnapshotId',
    ].every((key) => uuid(value[key])) ||
    !['programmingRevision', 'tariffRevision', 'inventoryRevision'].every(
      (key) => Number.isSafeInteger(value[key]) && value[key] > 0,
    ) ||
    !Number.isSafeInteger(value.routePointCount) ||
    value.routePointCount < 2 ||
    !Array.isArray(value.routePoints) ||
    value.routePoints.length !== value.routePointCount ||
    request.toPosition >= value.routePointCount ||
    !Array.isArray(value.seatIds) ||
    value.seatIds.some((id) => !uuid(id)) ||
    new Set(value.seatIds).size !== value.seatIds.length ||
    !instant(value.boardingAt) ||
    !instant(value.confirmedThroughExclusive) ||
    Date.parse(value.boardingAt) >= Date.parse(value.confirmedThroughExclusive)
  )
    fail();
  let previousDeparture;
  value.routePoints.forEach((point, index) => {
    if (
      !point ||
      point.position !== index ||
      typeof point.locationKey !== 'string' ||
      !point.locationKey.trim()
    )
      fail();
    if (index > 0 && (!instant(point.arrivalAt) || Date.parse(point.arrivalAt) < previousDeparture))
      fail();
    if (index < value.routePointCount - 1) {
      if (
        !instant(point.departureAt) ||
        (index > 0 && Date.parse(point.departureAt) < Date.parse(point.arrivalAt))
      )
        fail();
      previousDeparture = Date.parse(point.departureAt);
    }
  });
  if (value.boardingAt !== value.routePoints[request.fromPosition].departureAt) fail();
  return Object.freeze({
    tripId: value.tripId,
    cooperativeId: value.cooperativeId,
    routePointCount: value.routePointCount,
    seatIds: Object.freeze([...value.seatIds]),
  });
};
