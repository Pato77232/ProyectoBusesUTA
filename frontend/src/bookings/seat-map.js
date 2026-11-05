import { ApiError } from "../api/api-error.js";

const DECKS = Object.freeze([1, 2]);
const CATEGORIES = Object.freeze(["NORMAL", "VIP"]);
const isIndex = (value) => Number.isSafeInteger(value) && value >= 0;

function invalidMap() {
  return new ApiError(
    "RESPONSE_INVALID",
    "No se pudo leer la distribución de los asientos del viaje.",
  );
}

function validEntry(entry) {
  return (
    entry &&
    typeof entry.seatId === "string" &&
    entry.seatId &&
    Number.isSafeInteger(entry.label) &&
    entry.label >= 1 &&
    DECKS.includes(entry.deck) &&
    isIndex(entry.row) &&
    isIndex(entry.column) &&
    CATEGORIES.includes(entry.category)
  );
}

// Une estados (disponibilidad) con posiciones (distribución). Si no coinciden
// exactamente, no se ofrece ningún asiento: un número equivocado induce a error.
export function combineSeatMap(map, availability) {
  if (!Array.isArray(map?.seats) || !Array.isArray(availability))
    throw invalidMap();
  const layout = new Map();
  const labels = new Set();
  for (const entry of map.seats) {
    if (
      !validEntry(entry) ||
      layout.has(entry.seatId) ||
      labels.has(entry.label)
    )
      throw invalidMap();
    layout.set(entry.seatId, entry);
    labels.add(entry.label);
  }
  const regular = availability.filter((seat) => seat.category !== "ACCESSIBLE");
  if (
    regular.length !== layout.size ||
    regular.some((seat) => !layout.has(seat.seatId))
  )
    throw invalidMap();
  return availability.map((seat) => {
    const entry = layout.get(seat.seatId);
    return entry
      ? {
          ...seat,
          label: entry.label,
          deck: entry.deck,
          row: entry.row,
          column: entry.column,
          category: entry.category,
        }
      : { ...seat };
  });
}

export function seatName(seat) {
  if (seat?.category === "ACCESSIBLE") return "Espacio accesible";
  const name = "Asiento " + seat.label;
  return seat.category === "VIP" ? name + " (VIP)" : name;
}

// Pisos de arriba hacia abajo; dentro de cada piso, por fila y columna.
export function groupByDeck(seats) {
  const decks = new Map();
  for (const seat of seats) {
    if (seat.category === "ACCESSIBLE") continue;
    if (!decks.has(seat.deck)) decks.set(seat.deck, []);
    decks.get(seat.deck).push(seat);
  }
  return [...decks.entries()]
    .sort(([first], [second]) => second - first)
    .map(([deck, list]) => ({
      deck,
      seats: list.sort((a, b) => a.row - b.row || a.column - b.column),
    }));
}
