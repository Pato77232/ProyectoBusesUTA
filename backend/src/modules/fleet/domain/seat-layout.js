const KINDS = ['SEAT', 'AISLE', 'STAIRS', 'BATHROOM', 'MINIBAR', 'LUGGAGE'];
const ARRANGEMENTS = ['2+2', '2+1'];

class InvalidSeatLayoutError extends Error {
  constructor() {
    super('La distribución de la plantilla de asientos es inválida.');
    this.name = 'InvalidSeatLayoutError';
    this.code = 'INVALID_SEAT_LAYOUT';
  }
}

function requireValid(condition) {
  if (!condition) throw new InvalidSeatLayoutError();
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function nonEmptyText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateElement(element, deck, occupied, keys, labels) {
  requireValid(element && nonEmptyText(element.key) && !keys.has(element.key));
  keys.add(element.key);
  requireValid(KINDS.includes(element.kind));
  requireValid(Number.isSafeInteger(element.row) && element.row >= 0);
  requireValid(Number.isSafeInteger(element.column) && element.column >= 0);
  requireValid(positiveInteger(element.rowSpan) && positiveInteger(element.columnSpan));
  requireValid(element.row + element.rowSpan <= deck.rows);
  requireValid(element.column + element.columnSpan <= deck.columns);
  for (let row = element.row; row < element.row + element.rowSpan; row += 1) {
    for (let column = element.column; column < element.column + element.columnSpan; column += 1) {
      const cell = `${row}:${column}`;
      requireValid(!occupied.has(cell));
      occupied.add(cell);
    }
  }
  if (element.kind === 'SEAT') {
    requireValid(positiveInteger(element.label) && !labels.has(element.label));
    requireValid(element.category === 'NORMAL');
    requireValid(element.rowSpan === 1 && element.columnSpan === 1);
    labels.add(element.label);
  } else {
    requireValid(element.label === undefined && element.category === undefined);
  }
}

function freezeTree(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeTree);
    Object.freeze(value);
  }
  return value;
}

function createSeatLayout(input) {
  requireValid(input && nonEmptyText(input.id) && nonEmptyText(input.name));
  requireValid(positiveInteger(input.version) && positiveInteger(input.capacity));
  requireValid(ARRANGEMENTS.includes(input.arrangement));
  requireValid(Array.isArray(input.decks) && [1, 2].includes(input.decks.length));
  const labels = new Set();
  const keys = new Set();
  input.decks.forEach((deck, index) => {
    requireValid(deck && deck.number === input.decks.length - index);
    requireValid(positiveInteger(deck.rows) && positiveInteger(deck.columns));
    requireValid(Array.isArray(deck.elements) && deck.elements.length > 0);
    const occupied = new Set();
    deck.elements.forEach((element) => validateElement(element, deck, occupied, keys, labels));
    requireValid(deck.elements.some((element) => element.kind === 'SEAT'));
  });
  requireValid(labels.size === input.capacity);
  for (let label = 1; label <= input.capacity; label += 1) requireValid(labels.has(label));
  // La copia evita congelar o conservar referencias mutables del consumidor.
  return freezeTree(JSON.parse(JSON.stringify(input)));
}

module.exports = { createSeatLayout, InvalidSeatLayoutError };
