const {
  BusRegistrationValidationError,
  BusGroupNotFoundError,
} = require('./bus-registration-error');

const FIELDS = [
  'plate',
  'vin',
  'unitNumber',
  'bodyworkBrand',
  'color',
  'busGroupId',
  'seatLayoutId',
  'seatLayoutVersion',
  'disabledSeatKeys',
  'vipSeatKeys',
];
const PLATE_PATTERN = /^[A-Z]{3}-?[0-9]{4}$/;
const DECIMAL_PATTERN = /^[0-9]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLATE_LETTER_COUNT = 3;

function requireValid(condition) {
  if (!condition) throw new BusRegistrationValidationError();
}

function requiredText(value) {
  requireValid(typeof value === 'string' && value.trim().length > 0);
  return value.trim();
}

function canonicalPlate(value) {
  const plate = requiredText(value).toUpperCase();
  requireValid(PLATE_PATTERN.test(plate));
  return plate.replace('-', '');
}

function unitNumber(value) {
  let normalized = value;
  if (typeof value === 'string') {
    requireValid(DECIMAL_PATTERN.test(value.trim()));
    normalized = Number(value.trim());
  }
  requireValid(Number.isSafeInteger(normalized) && normalized > 0);
  return normalized;
}

function seatKeys(value = []) {
  requireValid(Array.isArray(value));
  const keys = [];
  for (const key of value) {
    requireValid(typeof key === 'string' && key.length > 0 && key === key.trim());
    keys.push(key);
  }
  requireValid(new Set(keys).size === keys.length);
  return Object.freeze(keys);
}

function createBusRegistrationData(input) {
  requireValid(input && typeof input === 'object' && !Array.isArray(input));
  requireValid([Object.prototype, null].includes(Object.getPrototypeOf(input)));
  requireValid(Object.keys(input).every((key) => FIELDS.includes(key)));
  const busGroupId = requiredText(input.busGroupId).toLowerCase();
  requireValid(UUID_PATTERN.test(busGroupId));
  requireValid(Number.isSafeInteger(input.seatLayoutVersion) && input.seatLayoutVersion > 0);
  return Object.freeze({
    plate: canonicalPlate(input.plate),
    vin: requiredText(input.vin).toUpperCase(),
    unitNumber: unitNumber(input.unitNumber),
    bodyworkBrand: requiredText(input.bodyworkBrand),
    color: requiredText(input.color),
    busGroupId,
    seatLayoutId: requiredText(input.seatLayoutId),
    seatLayoutVersion: input.seatLayoutVersion,
    disabledSeatKeys: seatKeys(input.disabledSeatKeys),
    // Campo opcional: un alta sin marcas conserva exactamente su forma anterior.
    ...(input.vipSeatKeys !== undefined && { vipSeatKeys: seatKeys(input.vipSeatKeys) }),
  });
}

function formatBusPlate(value) {
  const plate = canonicalPlate(value);
  return `${plate.slice(0, PLATE_LETTER_COUNT)}-${plate.slice(PLATE_LETTER_COUNT)}`;
}

/** El grupo procede del puerto del servidor; la cooperativa, del actor verificado. */
function assertBusGroupOwnership(group, cooperativeId, busGroupId) {
  if (
    typeof cooperativeId !== 'string' ||
    !UUID_PATTERN.test(cooperativeId) ||
    typeof busGroupId !== 'string' ||
    !UUID_PATTERN.test(busGroupId) ||
    !group ||
    group.id !== busGroupId ||
    group.cooperative_id !== cooperativeId
  ) {
    throw new BusGroupNotFoundError();
  }
}

module.exports = { createBusRegistrationData, formatBusPlate, assertBusGroupOwnership };
