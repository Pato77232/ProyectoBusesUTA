const BookingTripIntegrityError = require('./booking-trip-integrity-error');

const DECKS = Object.freeze([1, 2]);
const CATEGORIES = Object.freeze(['NORMAL', 'VIP']);

const isPositionIndex = (value) => Number.isSafeInteger(value) && value >= 0;

function validSeat(seat, seatIds) {
  return (
    seat &&
    typeof seat === 'object' &&
    seat.offered === true &&
    seatIds.has(seat.seatId) &&
    Number.isSafeInteger(seat.label) &&
    seat.label >= 1 &&
    DECKS.includes(seat.deck) &&
    isPositionIndex(seat.row) &&
    isPositionIndex(seat.column) &&
    CATEGORIES.includes(seat.category)
  );
}

function bySeatPosition(first, second) {
  return second.deck - first.deck || first.label - second.label;
}

// Distribución visible de los asientos ofrecidos (RN-12). No informa estados:
// la disponibilidad sigue siendo la única fuente de RN-40.
function createSeatMap({ seats, seatIds } = {}) {
  if (!Array.isArray(seats) || !Array.isArray(seatIds) || seats.length !== seatIds.length)
    throw new BookingTripIntegrityError();
  const expected = new Set(seatIds);
  const ids = new Set();
  const labels = new Set();
  const map = seats.map((seat) => {
    if (!validSeat(seat, expected) || ids.has(seat.seatId) || labels.has(seat.label))
      throw new BookingTripIntegrityError();
    ids.add(seat.seatId);
    labels.add(seat.label);
    return Object.freeze({
      seatId: seat.seatId,
      label: seat.label,
      deck: seat.deck,
      row: seat.row,
      column: seat.column,
      category: seat.category,
    });
  });
  return Object.freeze(map.sort(bySeatPosition));
}

module.exports = { createSeatMap };
