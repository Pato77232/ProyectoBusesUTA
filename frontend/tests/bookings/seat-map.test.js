import test from "node:test";
import assert from "node:assert/strict";
import {
  combineSeatMap,
  groupByDeck,
  seatName,
} from "../../src/bookings/seat-map.js";

const entry = (seatId, label, extra = {}) => ({
  seatId,
  label,
  deck: 1,
  row: 0,
  column: label - 1,
  category: "NORMAL",
  ...extra,
});
const map = () => ({
  seats: [
    entry("a", 1, { deck: 2 }),
    entry("b", 2, { row: 1, column: 0 }),
    entry("c", 3, { category: "VIP" }),
  ],
});
const availability = () => [
  { seatId: "b", status: "AVAILABLE" },
  { seatId: "a", status: "SOLD" },
  { seatId: "c", status: "RESERVED" },
];

test("une estado y posición sin perder el orden ni el estado de la disponibilidad", () => {
  const seats = combineSeatMap(map(), availability());
  assert.deepEqual(
    seats.map(({ seatId, status, label }) => [seatId, status, label]),
    [
      ["b", "AVAILABLE", 2],
      ["a", "SOLD", 1],
      ["c", "RESERVED", 3],
    ],
  );
});

test("agrupa del piso superior al inferior y ordena por fila y columna", () => {
  const decks = groupByDeck(combineSeatMap(map(), availability()));
  assert.deepEqual(
    decks.map(({ deck, seats }) => [deck, seats.map((seat) => seat.label)]),
    [
      [2, [1]],
      [1, [3, 2]],
    ],
  );
});

test("nombra el asiento por su número y distingue VIP y accesibles", () => {
  assert.equal(seatName({ label: 7, category: "NORMAL" }), "Asiento 7");
  assert.equal(seatName({ label: 3, category: "VIP" }), "Asiento 3 (VIP)");
  assert.equal(seatName({ category: "ACCESSIBLE" }), "Espacio accesible");
});

test("los espacios accesibles no necesitan número y quedan fuera de los pisos", () => {
  const seats = combineSeatMap(map(), [
    ...availability(),
    { seatId: "x", status: "AVAILABLE", category: "ACCESSIBLE" },
  ]);
  assert.equal(seats.at(-1).label, undefined);
  assert.equal(groupByDeck(seats).flatMap((deck) => deck.seats).length, 3);
});

for (const [name, value, seats] of [
  ["respuesta sin lista", {}, availability()],
  [
    "asiento faltante en la distribución",
    { seats: map().seats.slice(1) },
    availability(),
  ],
  ["asiento sobrante en la distribución", map(), availability().slice(1)],
  [
    "número repetido",
    { seats: [...map().seats.slice(0, 2), entry("c", 2)] },
    availability(),
  ],
  [
    "piso desconocido",
    { seats: [...map().seats.slice(0, 2), entry("c", 3, { deck: 3 })] },
    availability(),
  ],
  [
    "categoría desconocida",
    { seats: [...map().seats.slice(0, 2), entry("c", 3, { category: "X" })] },
    availability(),
  ],
  [
    "fila negativa",
    { seats: [...map().seats.slice(0, 2), entry("c", 3, { row: -1 })] },
    availability(),
  ],
]) {
  test("rechaza la distribución completa ante " + name, () => {
    assert.throws(() => combineSeatMap(value, seats), {
      code: "RESPONSE_INVALID",
    });
  });
}
