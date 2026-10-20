const { BookingValidationError } = require('./booking-error');

const MINOR_AGE_LIMIT = 18;
const SENIOR_AGE_START = 65;
const PREFERENTIAL_DISCOUNT_PERCENT = 50;

function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BookingValidationError();
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BookingValidationError();
  }
  return value;
}

function ageOnDate(birthDate, departureDate) {
  const birth = calendarDate(birthDate);
  const departure = calendarDate(departureDate);
  if (birth > departure) throw new BookingValidationError();
  const years = Number(departure.slice(0, 4)) - Number(birth.slice(0, 4));
  return years - (departure.slice(5) < birth.slice(5) ? 1 : 0);
}

function totalSegmentPrices(prices) {
  if (!Array.isArray(prices) || prices.length === 0) throw new BookingValidationError();
  let sum = 0;
  for (const amount of prices) {
    if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(sum + amount)) {
      throw new BookingValidationError();
    }
    sum += amount;
  }
  return sum;
}

// Recibe fechas y acreditación del servidor. Calcular no acredita datos declarados.
function quotePassenger({ segmentPricesCents, birthDate, departureDate, disabilityVerified } = {}) {
  if (typeof disabilityVerified !== 'boolean') throw new BookingValidationError();
  const age = ageOnDate(birthDate, departureDate);
  const basePriceCents = totalSegmentPrices(segmentPricesCents);
  const eligibleCategories = [];
  if (age < MINOR_AGE_LIMIT) eligibleCategories.push('MINOR');
  if (age >= SENIOR_AGE_START) eligibleCategories.push('SENIOR');
  if (disabilityVerified) eligibleCategories.push('DISABILITY');
  const hasDiscount = eligibleCategories.length > 0;
  // Mitad hacia arriba sin operaciones que desborden al sumar 1 a un entero grande.
  const totalPriceCents = hasDiscount
    ? Math.floor(basePriceCents / 2) + (basePriceCents % 2)
    : basePriceCents;

  return Object.freeze({
    currency: 'USD',
    basePriceCents,
    discountPercent: hasDiscount ? PREFERENTIAL_DISCOUNT_PERCENT : 0,
    discountCents: basePriceCents - totalPriceCents,
    totalPriceCents,
    eligibleCategories: Object.freeze(eligibleCategories),
  });
}

module.exports = { quotePassenger, ageOnDate };
