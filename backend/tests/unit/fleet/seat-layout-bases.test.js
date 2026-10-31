'use strict';

const {
  createBaseSeatLayouts,
} = require('../../../src/modules/fleet/infrastructure/seat-layout-bases');
const {
  createSeatLayout,
  InvalidSeatLayoutError,
} = require('../../../src/modules/fleet/domain/seat-layout');

const seats = (floor) => floor.elements.filter((entry) => entry.kind === 'SEAT');
const copy = (value) => JSON.parse(JSON.stringify(value));
const layouts = createBaseSeatLayouts();

function numberedRows(floor) {
  return Array.from({ length: floor.rows }, (_, row) =>
    seats(floor)
      .filter((seat) => seat.row === row)
      .sort((a, b) => a.column - b.column)
      .map((seat) => seat.label),
  );
}

test('las tres bases tienen identidades, orden, capacidad y pisos estables', () => {
  expect(
    layouts.map(({ id, capacity, decks, version }) => ({
      id,
      capacity,
      version,
      floors: decks.map((floor) => [floor.number, seats(floor).length]),
    })),
  ).toEqual([
    { id: 'SINGLE_DECK_2_2', capacity: 42, version: 1, floors: [[1, 42]] },
    {
      id: 'DOUBLE_DECK_2_2',
      capacity: 60,
      version: 1,
      floors: [
        [2, 44],
        [1, 16],
      ],
    },
    {
      id: 'DOUBLE_DECK_2_1',
      capacity: 46,
      version: 1,
      floors: [
        [2, 34],
        [1, 12],
      ],
    },
  ]);
});

test('un piso conserva los pares derechos invertidos y la última fila parcial', () => {
  expect(numberedRows(layouts[0].decks[0])).toEqual([
    [1, 2, 4, 3],
    [5, 6, 8, 7],
    [9, 10, 12, 11],
    [13, 14, 16, 15],
    [17, 18, 20, 19],
    [21, 22, 24, 23],
    [25, 26, 28, 27],
    [29, 30, 32, 31],
    [33, 34, 36, 35],
    [37, 38, 40, 39],
    [41, 42],
  ]);
  expect(layouts[0].decks[0].elements).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'MINIBAR', row: 10, column: 3 }),
      expect.objectContaining({ kind: 'BATHROOM', row: 10, column: 4 }),
    ]),
  );
});

test('dos pisos 2+2 conserva filas de escaleras y numeración entre pisos', () => {
  expect(numberedRows(layouts[1].decks[0])).toEqual([
    [1, 2, 4, 3],
    [5, 6],
    [7, 8],
    [9, 10, 12, 11],
    [13, 14, 16, 15],
    [17, 18, 20, 19],
    [21, 22, 24, 23],
    [25, 26, 28, 27],
    [29, 30, 32, 31],
    [33, 34, 36, 35],
    [37, 38, 40, 39],
    [41, 42, 44, 43],
  ]);
  expect(numberedRows(layouts[1].decks[1])).toEqual([
    [],
    [45, 46, 48, 47],
    [49, 50, 52, 51],
    [53, 54, 56, 55],
    [57, 58, 60, 59],
    [],
    [],
  ]);
});

test('dos pisos 2+1 numera pares e individuales a la derecha sin ocupar la escalera', () => {
  expect(numberedRows(layouts[2].decks[0])).toEqual([
    [1, 2, 3],
    [4, 5],
    [6, 7],
    [8, 9, 10],
    [11, 12, 13],
    [14, 15, 16],
    [17, 18, 19],
    [20, 21, 22],
    [23, 24, 25],
    [26, 27, 28],
    [29, 30, 31],
    [32, 33, 34],
  ]);
  expect(numberedRows(layouts[2].decks[1])).toEqual([
    [],
    [35, 36, 37],
    [38, 39, 40],
    [41, 42, 43],
    [44, 45, 46],
    [],
    [],
  ]);
  for (const floor of layouts[2].decks) {
    expect(
      seats(floor)
        .filter((seat) => seat.column > 1)
        .every((seat) => seat.column === 3),
    ).toBe(true);
  }
});

test.each([1, 2])(
  'la base doble %i conserva los servicios y el equipaje fuera del inventario',
  (index) => {
    const [upper, lower] = layouts[index].decks;
    expect(upper.elements.filter((entry) => entry.kind === 'STAIRS')).toEqual([
      expect.objectContaining({ row: 1, column: 3, rowSpan: 2, columnSpan: 2 }),
    ]);
    expect(lower.elements.filter((entry) => !['SEAT', 'AISLE'].includes(entry.kind))).toEqual([
      expect.objectContaining({ kind: 'BATHROOM', row: 0, column: 0 }),
      expect.objectContaining({ kind: 'STAIRS', row: 0, column: 3 }),
      expect.objectContaining({ kind: 'MINIBAR', row: 5, column: 2 }),
      expect.objectContaining({ kind: 'LUGGAGE', row: 6, column: 0, columnSpan: 5 }),
    ]);
  },
);

test('solo asientos normales con claves únicas; ningún servicio tiene etiqueta de asiento', () => {
  for (const layout of layouts) {
    const elements = layout.decks.flatMap((floor) => floor.elements);
    expect(new Set(elements.map((entry) => entry.key)).size).toBe(elements.length);
    expect(
      elements.filter((entry) => entry.kind === 'SEAT').every((seat) => seat.category === 'NORMAL'),
    ).toBe(true);
    for (const service of elements.filter((entry) => entry.kind !== 'SEAT')) {
      expect(service.label).toBeUndefined();
      expect(service.category).toBeUndefined();
    }
  }
});

test('las lecturas son deterministas e inmutables sin conservar referencias del consumidor', () => {
  const input = copy(layouts[0]);
  const result = createSeatLayout(input);
  input.decks[0].elements[0].label = 999;
  expect(result.decks[0].elements[0].label).toBe(1);
  expect(() => {
    result.decks[0].elements[0].label = 999;
  }).toThrow(TypeError);
  expect(() => {
    result.decks.push({});
  }).toThrow(TypeError);
  expect(() => {
    layouts.push({});
  }).toThrow(TypeError);
  expect(createBaseSeatLayouts()).toEqual(layouts);
});

const invalidChanges = [
  [
    'capacidad incorrecta',
    (layout) => {
      layout.capacity += 1;
    },
  ],
  [
    'etiqueta repetida entre pisos',
    (layout) => {
      seats(layout.decks[1])[0].label = 1;
    },
  ],
  [
    'clave repetida',
    (layout) => {
      layout.decks[1].elements[0].key = layout.decks[0].elements[0].key;
    },
  ],
  [
    'asiento sobre escalera',
    (layout) => {
      Object.assign(seats(layout.decks[0])[0], { row: 1, column: 3 });
    },
  ],
  [
    'asiento sobre pasillo',
    (layout) => {
      seats(layout.decks[0])[0].column = 2;
    },
  ],
  [
    'fuera de límites',
    (layout) => {
      seats(layout.decks[0])[0].row = 12;
    },
  ],
  [
    'coordenada negativa',
    (layout) => {
      seats(layout.decks[0])[0].column = -1;
    },
  ],
  [
    'coordenada fraccionaria',
    (layout) => {
      seats(layout.decks[0])[0].row = 0.5;
    },
  ],
  [
    'servicio fuera de límites',
    (layout) => {
      layout.decks[0].elements.find((entry) => entry.kind === 'STAIRS').rowSpan = 20;
    },
  ],
  [
    'extensión vacía',
    (layout) => {
      seats(layout.decks[0])[0].columnSpan = 0;
    },
  ],
  [
    'categoría no acordada',
    (layout) => {
      seats(layout.decks[0])[0].category = 'VIP';
    },
  ],
  [
    'servicio con etiqueta',
    (layout) => {
      layout.decks[1].elements[0].label = 61;
    },
  ],
  [
    'tipo desconocido',
    (layout) => {
      layout.decks[1].elements[0].kind = 'UNKNOWN';
    },
  ],
  [
    'numeración sin continuidad',
    (layout) => {
      seats(layout.decks[0])[0].label = 99;
    },
  ],
  [
    'pisos repetidos',
    (layout) => {
      layout.decks[1].number = 2;
    },
  ],
  [
    'orden de pisos incorrecto',
    (layout) => {
      layout.decks.reverse();
    },
  ],
  [
    'versión inválida',
    (layout) => {
      layout.version = 0;
    },
  ],
];

test.each(invalidChanges)('rechaza %s con error explícito de dominio', (_, change) => {
  const invalid = copy(layouts[1]);
  change(invalid);
  expect(() => createSeatLayout(invalid)).toThrow(InvalidSeatLayoutError);
  try {
    createSeatLayout(invalid);
  } catch (error) {
    expect(error.code).toBe('INVALID_SEAT_LAYOUT');
  }
});

test.each([null, {}, { ...copy(layouts[0]), decks: null }])(
  'rechaza estructura incompleta %j',
  (input) => {
    expect(() => createSeatLayout(input)).toThrow(InvalidSeatLayoutError);
  },
);
