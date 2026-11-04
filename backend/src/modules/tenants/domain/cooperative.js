const CooperativeError = require('./cooperative-error');
const FIELDS = ['name', 'ruc', 'email', 'phone', 'address'];
const RUC_PATTERN = /^[0-9]{13}$/;
function invalid() {
  throw new CooperativeError('VALIDATION_ERROR');
}
function optionalText(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return invalid();
  return value.trim() || null;
}
function createCooperativeData(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !FIELDS.includes(key))
  )
    return invalid();
  if (
    typeof input.name !== 'string' ||
    !input.name.trim() ||
    typeof input.ruc !== 'string' ||
    !RUC_PATTERN.test(input.ruc.trim())
  )
    return invalid();
  const email = optionalText(input.email)?.toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return invalid();
  return Object.freeze({
    name: input.name.trim(),
    ruc: input.ruc.trim(),
    email,
    phone: optionalText(input.phone),
    address: optionalText(input.address),
  });
}
module.exports = { createCooperativeData };
