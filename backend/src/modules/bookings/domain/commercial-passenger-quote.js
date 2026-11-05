const { ageOnDate } = require('./passenger-quote');
const { BookingValidationError } = require('./booking-error');
const DENOMINATOR = 100_000_000n;
const BPS = 10_000n;
const MAX_BASE_PRICE_CENTS = 9_999_999_999;
const MINOR_AGE_LIMIT = 18;
const SENIOR_AGE_START = 65;
const round = (numerator) => Number((numerator + DENOMINATOR / 2n) / DENOMINATOR);

function commercialPassengerQuote({
  amountCents,
  policy,
  category,
  birthDate,
  departureDate,
  disabilityVerified,
}) {
  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents <= 0 ||
    amountCents > MAX_BASE_PRICE_CENTS ||
    !['NORMAL', 'VIP', 'ACCESSIBLE'].includes(category) ||
    typeof disabilityVerified !== 'boolean' ||
    policy?.discountStrategy !== 'MAX_ELIGIBLE' ||
    ['vipSurchargeBps', 'minorDiscountBps', 'seniorDiscountBps', 'disabilityDiscountBps'].some(
      (key) => !Number.isInteger(policy[key]) || policy[key] < 0 || policy[key] > Number(BPS),
    )
  )
    throw new BookingValidationError();
  const age = ageOnDate(birthDate, departureDate);
  const eligible = [];
  if (age < MINOR_AGE_LIMIT) eligible.push(['MINOR', policy.minorDiscountBps]);
  if (age >= SENIOR_AGE_START) eligible.push(['SENIOR', policy.seniorDiscountBps]);
  if (disabilityVerified) eligible.push(['DISABILITY', policy.disabilityDiscountBps]);
  const discountBps = Math.max(0, ...eligible.map((entry) => entry[1]));
  const surcharge =
    category === 'VIP' ? BigInt(amountCents) * BigInt(policy.vipSurchargeBps) * BPS : 0n;
  const gross = BigInt(amountCents) * DENOMINATOR + surcharge;
  const discount = (gross * BigInt(discountBps)) / BPS;
  const total = gross - discount;
  const vipSurchargeCents = round(surcharge),
    discountCents = round(discount),
    totalPriceCents = round(total);
  return Object.freeze({
    currency: 'USD',
    basePriceCents: amountCents,
    vipSurchargeCents,
    discountCents,
    totalPriceCents,
    roundingAdjustmentCents: totalPriceCents - (amountCents + vipSurchargeCents - discountCents),
    discountBps,
    eligibleCategories: Object.freeze(eligible.map(([name]) => name)),
    appliedCategories: Object.freeze(
      eligible.filter(([, bps]) => bps === discountBps).map(([name]) => name),
    ),
    exact: Object.freeze({
      denominator: String(DENOMINATOR),
      vipSurchargeNumerator: String(surcharge),
      discountNumerator: String(discount),
      totalNumerator: String(total),
    }),
  });
}
module.exports = commercialPassengerQuote;
