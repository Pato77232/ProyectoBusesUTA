const Failure = require('./benefit-request-error');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validUuid = (value) => typeof value === 'string' && UUID.test(value);
const invalid = () => {
  throw new Failure('BOOKING_BENEFIT_REQUEST_INVALID');
};
function uuid(value) {
  if (typeof value !== 'string' || !UUID.test(value)) invalid();
  return value.toLowerCase();
}
function actor(context, roles) {
  if (typeof context?.sid !== 'string' || !context.sid.trim() || !validUuid(context?.user?.id))
    throw new Failure('UNAUTHENTICATED');
  const user = context.user;
  if (
    !roles.includes(user.role) ||
    (user.role === 'CUSTOMER' ? user.cooperative_id !== null : !validUuid(user.cooperative_id))
  )
    throw new Failure('FORBIDDEN');
  return Object.freeze({
    role: user.role,
    userId: user.id.toLowerCase(),
    cooperativeId: user.cooperative_id?.toLowerCase() ?? null,
  });
}
function key(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(value)) invalid();
  return value;
}
function page(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((k) => !['limit', 'cursor'].includes(k))
  )
    invalid();
  const limit =
    input.limit === undefined
      ? 20
      : typeof input.limit === 'string' && /^[1-9][0-9]*$/.test(input.limit)
        ? Number(input.limit)
        : NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) invalid();
  return Object.freeze({ limit, cursor: input.cursor === undefined ? null : uuid(input.cursor) });
}
function time(value) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new Failure();
  return new Date(value.getTime());
}
function iso(value) {
  const result = value instanceof Date ? value.toISOString() : value;
  if (
    typeof result !== 'string' ||
    !Number.isFinite(Date.parse(result)) ||
    new Date(result).toISOString() !== result
  )
    throw new Failure();
  return result;
}
function visible(row, identity, evaluatedAt) {
  if (
    !row ||
    (identity.role === 'CUSTOMER'
      ? row.ownerId !== identity.userId
      : row.cooperativeId !== identity.cooperativeId)
  )
    throw new Failure('BOOKING_BENEFIT_REQUEST_NOT_FOUND');
  if (
    !UUID.test(row.id) ||
    !UUID.test(row.tripId) ||
    !(
      (row.status === 'PENDING' && row.revision === 1) ||
      (row.status === 'REVIEWED' && row.revision === 2)
    ) ||
    !Number.isSafeInteger(Number(row.fromPosition)) ||
    Number(row.fromPosition) < 0 ||
    !Number.isSafeInteger(Number(row.toPosition)) ||
    Number(row.toPosition) <= Number(row.fromPosition) ||
    !Number.isInteger(row.passengerCount) ||
    row.passengerCount < 1 ||
    !row.journey ||
    typeof row.journey.fromPlace !== 'string' ||
    !row.journey.fromPlace.trim() ||
    typeof row.journey.toPlace !== 'string' ||
    !row.journey.toPlace.trim()
  )
    throw new Failure();
  const createdAt = iso(row.createdAt),
    expiresAt = iso(row.expiresAt);
  if (createdAt >= expiresAt) throw new Failure();
  const reviewedAt = row.status === 'REVIEWED' ? iso(row.reviewedAt) : null;
  if (reviewedAt && (reviewedAt < createdAt || reviewedAt >= expiresAt)) throw new Failure();
  return Object.freeze({
    ...(reviewedAt ? { reviewedAt } : {}),
    requestId: row.id,
    tripId: row.tripId,
    fromPosition: Number(row.fromPosition),
    toPosition: Number(row.toPosition),
    fromPlace: row.journey.fromPlace,
    toPlace: row.journey.toPlace,
    passengerCount: row.passengerCount,
    revision: row.revision,
    status: evaluatedAt.getTime() >= Date.parse(expiresAt) ? 'EXPIRED' : row.status,
    createdAt,
    expiresAt,
    evaluatedAt: evaluatedAt.toISOString(),
  });
}
module.exports = { uuid, actor, key, page, time, visible };
