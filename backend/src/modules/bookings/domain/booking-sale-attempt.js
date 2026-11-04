const { request } = require('./booking-lifecycle');
const BookingSaleError = require('./booking-sale-error');
const LINKS = ['bookingId', 'cooperativeId', 'paymentProofId'];
const INTENT_FIELDS = [...LINKS, 'proofVersion', 'requestedBy', 'requestedAt'];
const RESULT_FIELDS = [...INTENT_FIELDS, 'currency', 'totalPriceCents', 'confirmedAt'];
const fail = (code) => {
  throw new BookingSaleError(code);
};

function record(value, fields) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === fields.length &&
    fields.every((field) => Object.hasOwn(value, field))
  );
}
function instant(value) {
  return (
    typeof value === 'string' &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

// Valida datos; no acredita permisos ni consulta la fuente autorizada de Payments.
function verifySaleIntent(target, source) {
  const scope = request(target);
  if (
    !record(source, INTENT_FIELDS) ||
    LINKS.some((field) => typeof source[field] !== 'string' || !source[field].trim()) ||
    !Number.isSafeInteger(source.proofVersion) ||
    source.proofVersion < 1 ||
    typeof source.requestedBy !== 'string' ||
    !source.requestedBy.trim() ||
    !instant(source.requestedAt)
  )
    fail();
  if (LINKS.some((field) => source[field] !== scope[field])) fail('BOOKING_SALE_LINK_MISMATCH');
  return Object.freeze(Object.fromEntries(INTENT_FIELDS.map((field) => [field, source[field]])));
}

// Solo recupera un resultado ya persistido; nunca crea ni confirma una venta.
function recoverSaleResult(attempt, previous) {
  if (!record(attempt, INTENT_FIELDS)) fail();
  const scope = Object.fromEntries(LINKS.map((field) => [field, attempt[field]]));
  const verified = verifySaleIntent(scope, attempt);
  if (previous === null) return null;
  if (!record(previous, RESULT_FIELDS)) fail();
  const original = verifySaleIntent(
    scope,
    Object.fromEntries(INTENT_FIELDS.map((field) => [field, previous[field]])),
  );
  if (original.proofVersion !== verified.proofVersion) fail('BOOKING_SALE_VERSION_MISMATCH');
  if (
    original.requestedBy !== verified.requestedBy ||
    original.requestedAt !== verified.requestedAt ||
    previous.currency !== 'USD' ||
    !Number.isSafeInteger(previous.totalPriceCents) ||
    previous.totalPriceCents < 0 ||
    !instant(previous.confirmedAt) ||
    Date.parse(previous.confirmedAt) < Date.parse(original.requestedAt)
  )
    fail();
  return Object.freeze(Object.fromEntries(RESULT_FIELDS.map((field) => [field, previous[field]])));
}

module.exports = { verifySaleIntent, recoverSaleResult };
