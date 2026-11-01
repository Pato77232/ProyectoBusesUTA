const { createSeatLayout } = require('../domain/seat-layout');

const LEFT_COLUMNS = [0, 1];
const AISLE_COLUMN = 2;
const RIGHT_COLUMNS = [3, 4];
const GRID_COLUMNS = 5;
const UPPER_ROWS = 12;
const SINGLE_ROWS = 11;
const UPPER_STAIR_ROWS = [1, 2];

function element(deckNumber, kind, row, column, extra = {}) {
  return {
    key: `deck-${deckNumber}-${row}-${column}`,
    kind,
    row,
    column,
    rowSpan: 1,
    columnSpan: 1,
    ...extra,
  };
}

function addSeatRow(deck, row, firstLabel, rightSeatCount, reverseRightPair = false) {
  LEFT_COLUMNS.forEach((column, index) => {
    deck.elements.push(
      element(deck.number, 'SEAT', row, column, { label: firstLabel + index, category: 'NORMAL' }),
    );
  });
  deck.elements.push(element(deck.number, 'AISLE', row, AISLE_COLUMN));
  RIGHT_COLUMNS.slice(0, rightSeatCount).forEach((column, index) => {
    const offset = reverseRightPair ? 3 - index : 2 + index;
    deck.elements.push(
      element(deck.number, 'SEAT', row, column, {
        label: firstLabel + offset,
        category: 'NORMAL',
      }),
    );
  });
  return firstLabel + LEFT_COLUMNS.length + rightSeatCount;
}

function deck(number, rows) {
  return { number, rows, columns: GRID_COLUMNS, elements: [] };
}

function singleDeck() {
  const floor = deck(1, SINGLE_ROWS);
  let nextLabel = 1;
  for (let row = 0; row < SINGLE_ROWS; row += 1) {
    nextLabel = addSeatRow(floor, row, nextLabel, row === SINGLE_ROWS - 1 ? 0 : 2, true);
  }
  floor.elements.push(element(1, 'MINIBAR', SINGLE_ROWS - 1, 3));
  floor.elements.push(element(1, 'BATHROOM', SINGLE_ROWS - 1, 4));
  return [floor];
}

function doubleDeck(rightSeatCount) {
  const upper = deck(2, UPPER_ROWS);
  let nextLabel = 1;
  for (let row = 0; row < UPPER_ROWS; row += 1) {
    const count = UPPER_STAIR_ROWS.includes(row) ? 0 : rightSeatCount;
    nextLabel = addSeatRow(upper, row, nextLabel, count, rightSeatCount === 2);
  }
  upper.elements.push(element(2, 'STAIRS', 1, 3, { rowSpan: 2, columnSpan: 2 }));

  // Servicios delante, cuatro filas de asientos, minibar y equipaje detrás.
  const lower = deck(1, 7);
  lower.elements.push(element(1, 'BATHROOM', 0, 0, { columnSpan: 2 }));
  lower.elements.push(element(1, 'STAIRS', 0, 3, { columnSpan: 2 }));
  lower.elements.push(element(1, 'AISLE', 0, AISLE_COLUMN));
  for (let row = 1; row <= 4; row += 1) {
    nextLabel = addSeatRow(lower, row, nextLabel, rightSeatCount, rightSeatCount === 2);
  }
  lower.elements.push(element(1, 'MINIBAR', 5, AISLE_COLUMN));
  lower.elements.push(element(1, 'LUGGAGE', 6, 0, { columnSpan: GRID_COLUMNS }));
  return [upper, lower];
}

function createBaseSeatLayouts() {
  const definitions = [
    ['SINGLE_DECK_2_2', 'Un piso 2+2', '2+2', 42, singleDeck()],
    ['DOUBLE_DECK_2_2', 'Dos pisos 2+2', '2+2', 60, doubleDeck(2)],
    ['DOUBLE_DECK_2_1', 'Dos pisos 2+1', '2+1', 46, doubleDeck(1)],
  ];
  return Object.freeze(
    definitions.map(([id, name, arrangement, capacity, decks]) =>
      createSeatLayout({ id, name, arrangement, capacity, version: 1, decks }),
    ),
  );
}

module.exports = { createBaseSeatLayouts };
