const { BookingValidationError } = require('./booking-error');
const { ageOnDate } = require('./passenger-quote');

const BPS = 10000n;
const TOTAL_SCALE = BPS * BPS;
const MAX_BASE_CENTS = 9999999999;
const INPUT_KEYS = ['basePriceCents', 'seatCategory', 'policy', 'passenger', 'boardingDate'];
const PERCENT_KEYS = [
  'vipSurchargeBps',
  'minorDiscountBps',
  'seniorDiscountBps',
  'disabilityDiscountBps',
];

function record(value, keys) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function rational(numerator, denominator) {
  let left = numerator < 0n ? -numerator : numerator;
  let right = denominator;
  while (right !== 0n) [left, right] = [right, left % right];
  return Object.freeze({
    numerator: String(numerator / left),
    denominator: String(denominator / left),
  });
}

function validate(input) {
  if (
    !record(input, INPUT_KEYS) ||
    !Number.isSafeInteger(input.basePriceCents) ||
    input.basePriceCents < 1 ||
    input.basePriceCents > MAX_BASE_CENTS ||
    !['NORMAL', 'VIP'].includes(input.seatCategory) ||
    !record(input.policy, [...PERCENT_KEYS, 'discountStrategy']) ||
    input.policy.discountStrategy !== 'MAX_ELIGIBLE' ||
    !PERCENT_KEYS.every(
      (key) =>
        Number.isInteger(input.policy[key]) && input.policy[key] >= 0 && input.policy[key] <= 10000,
    ) ||
    !record(input.passenger, ['birthDate', 'disabilityVerified']) ||
    typeof input.passenger.disabilityVerified !== 'boolean'
  )
    throw new BookingValidationError();
}

// Solo calcula: la aplicación futura debe aportar fecha local y datos ya acreditados.
function quoteConfiguredPassenger(input) {
  validate(input);
  const { basePriceCents, seatCategory, policy, passenger, boardingDate } = input;
  const age = ageOnDate(passenger.birthDate, boardingDate);
  const benefits = [];
  if (age < 18) benefits.push(['MINOR', policy.minorDiscountBps]);
  if (age >= 65) benefits.push(['SENIOR', policy.seniorDiscountBps]);
  if (passenger.disabilityVerified) benefits.push(['DISABILITY', policy.disabilityDiscountBps]);
  const discountBps = Math.max(0, ...benefits.map(([, bps]) => bps));
  const vipSurchargeBps = seatCategory === 'VIP' ? policy.vipSurchargeBps : 0;
  const base = BigInt(basePriceCents);
  const vip = BigInt(vipSurchargeBps);
  const discount = BigInt(discountBps);
  const subtotalNumerator = base * (BPS + vip);
  const totalNumerator = subtotalNumerator * (BPS - discount);
  const rounded = (totalNumerator + TOTAL_SCALE / 2n) / TOTAL_SCALE;

  return Object.freeze({
    currency: 'USD',
    basePriceCents,
    vipSurchargeBps,
    discountBps,
    eligibleCategories: Object.freeze(benefits.map(([category]) => category)),
    appliedBenefitCategories: Object.freeze(
      benefits.filter(([, bps]) => bps === discountBps).map(([category]) => category),
    ),
    vipSurchargeExactCents: rational(base * vip, BPS),
    discountExactCents: rational(subtotalNumerator * discount, TOTAL_SCALE),
    totalExactCents: rational(totalNumerator, TOTAL_SCALE),
    roundingAdjustmentCents: rational(rounded * TOTAL_SCALE - totalNumerator, TOTAL_SCALE),
    totalPriceCents: Number(rounded),
  });
}

module.exports = { quoteConfiguredPassenger };
