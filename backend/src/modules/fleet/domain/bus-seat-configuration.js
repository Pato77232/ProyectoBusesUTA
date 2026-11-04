const { createSeatLayout } = require('./seat-layout');
const { createBusRegistrationData } = require('./bus-registration');
const {
  BusRegistrationValidationError,
  BusSeatLayoutNotFoundError,
} = require('./bus-registration-error');

const VIP_CATEGORY = 'VIP';

function createBusSeatConfiguration(input, serverLayout) {
  const data = createBusRegistrationData(input);
  if (!serverLayout) throw new BusSeatLayoutNotFoundError();
  // Un proveedor averiado no equivale a una plantilla inexistente.
  const layout = createSeatLayout(serverLayout);
  if (layout.id !== data.seatLayoutId || layout.version !== data.seatLayoutVersion) {
    throw new BusSeatLayoutNotFoundError();
  }
  const positions = layout.decks.flatMap((deck) =>
    deck.elements
      .filter((element) => element.kind === 'SEAT')
      .map((element) => ({ ...element, deck: deck.number })),
  );
  const validKeys = new Set(positions.map((position) => position.key));
  const disabled = new Set(data.disabledSeatKeys);
  const vip = new Set(data.vipSeatKeys ?? []);
  if ([...disabled, ...vip].some((key) => !validKeys.has(key))) {
    throw new BusRegistrationValidationError();
  }
  const seats = positions.map((position) =>
    Object.freeze({
      layoutSeatKey: position.key,
      label: position.label,
      deck: position.deck,
      row: position.row,
      column: position.column,
      category: vip.has(position.key) ? VIP_CATEGORY : position.category,
      offered: !disabled.has(position.key),
    }),
  );
  const capacity = seats.filter((seat) => seat.offered).length;
  if (capacity < 1) throw new BusRegistrationValidationError();
  return Object.freeze({ layout, seats: Object.freeze(seats), capacity });
}

module.exports = { createBusSeatConfiguration };
