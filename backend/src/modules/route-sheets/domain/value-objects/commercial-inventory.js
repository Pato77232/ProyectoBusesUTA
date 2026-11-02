const {
  CommercialTripValidationError,
  CommercialTripConflictError,
  CommercialTripSourceError,
} = require('../errors/commercial-trip-errors');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function tripUuid(value) {
  if (typeof value !== 'string' || !UUID.test(value))
    throw new CommercialTripValidationError('Identificador comercial inválido.');
  return value.toLowerCase();
}
function sourceInvalid() {
  throw new CommercialTripSourceError();
}

function commercialInventory(source, busId) {
  if (source === null)
    throw new CommercialTripConflictError(
      'COMMERCIAL_INVENTORY_UNAVAILABLE',
      'El bus no tiene un inventario comercial verificable.',
    );
  if (!source || source.busId !== busId || !Array.isArray(source.seats)) sourceInvalid();
  const ids = new Set(),
    keys = new Set(),
    labels = new Set();
  const seats = Array.from(source.seats, (seat) => {
    if (
      !seat ||
      typeof seat !== 'object' ||
      typeof seat.seatId !== 'string' ||
      !UUID.test(seat.seatId) ||
      typeof seat.layoutSeatKey !== 'string' ||
      !seat.layoutSeatKey.trim() ||
      !Number.isSafeInteger(seat.label) ||
      seat.label < 1 ||
      ![1, 2].includes(seat.deck) ||
      !Number.isSafeInteger(seat.row) ||
      seat.row < 0 ||
      !Number.isSafeInteger(seat.column) ||
      seat.column < 0 ||
      !['NORMAL', 'VIP'].includes(seat.category) ||
      typeof seat.offered !== 'boolean'
    )
      sourceInvalid();
    const id = seat.seatId.toLowerCase();
    if (ids.has(id) || keys.has(seat.layoutSeatKey) || labels.has(seat.label)) sourceInvalid();
    ids.add(id);
    keys.add(seat.layoutSeatKey);
    labels.add(seat.label);
    return Object.freeze({
      seatId: id,
      layoutSeatKey: seat.layoutSeatKey,
      label: seat.label,
      deck: seat.deck,
      row: seat.row,
      column: seat.column,
      category: seat.category,
      offered: seat.offered,
    });
  }).filter((seat) => seat.offered);
  if (!seats.length)
    throw new CommercialTripConflictError(
      'COMMERCIAL_INVENTORY_EMPTY',
      'El bus no tiene asientos ofrecidos para publicar.',
    );
  return Object.freeze({ schemaVersion: 1, busId, seats: Object.freeze(seats) });
}
module.exports = { commercialInventory, tripUuid };
