'use strict';

const {
  createBusSeatConfiguration,
} = require('../../../src/modules/fleet/domain/bus-seat-configuration');
const {
  createBaseSeatLayouts,
} = require('../../../src/modules/fleet/infrastructure/seat-layout-bases');
const { InvalidSeatLayoutError } = require('../../../src/modules/fleet/domain/seat-layout');
const {
  BusRegistrationValidationError,
  BusSeatLayoutNotFoundError,
} = require('../../../src/modules/fleet/domain/bus-registration-error');

const base = createBaseSeatLayouts()[0];
const metadata = {
  plate: 'TBM-2213',
  vin: 'VIN',
  unitNumber: 1,
  bodyworkBrand: 'Marca',
  color: 'Azul',
  busGroupId: 'a71451ae-b125-4274-a583-15dfe4999201',
  seatLayoutId: base.id,
  seatLayoutVersion: base.version,
};

test('identifica espacios accesibles sin venderlos ni contarlos en capacidad', () => {
  const key = base.decks[0].elements.find((e) => e.kind === 'SEAT').key;
  const result = createBusSeatConfiguration({ ...metadata, accessibleSeatKeys: [key] }, base);
  expect(result.seats.find((s) => s.layoutSeatKey === key)).toMatchObject({
    category: 'ACCESSIBLE',
    offered: false,
  });
  expect(result.capacity).toBe(base.capacity - 1);
  expect(() =>
    createBusSeatConfiguration(
      { ...metadata, accessibleSeatKeys: [key], vipSeatKeys: [key] },
      base,
    ),
  ).toThrow(BusRegistrationValidationError);
  expect(() =>
    createBusSeatConfiguration({ ...metadata, accessibleSeatKeys: ['inexistente'] }, base),
  ).toThrow(BusRegistrationValidationError);
});

test('sin desactivaciones conserva todos los asientos y calcula capacidad', () => {
  const result = createBusSeatConfiguration(metadata, base);
  expect(result.capacity).toBe(42);
  expect(result.seats).toHaveLength(42);
  expect(result.seats.every((seat) => seat.offered && seat.category === 'NORMAL')).toBe(true);
  expect(result.seats[0]).toEqual({
    layoutSeatKey: 'deck-1-0-0',
    label: 1,
    deck: 1,
    row: 0,
    column: 0,
    category: 'NORMAL',
    offered: true,
  });
  expect(result.seats.every((seat) => seat.id === undefined)).toBe(true);
});

test('desactiva posiciones por bus sin renumerar ni cambiar la base o los demás buses', () => {
  const result = createBusSeatConfiguration(
    { ...metadata, disabledSeatKeys: ['deck-1-0-0', 'deck-1-10-1'] },
    base,
  );
  expect(result.capacity).toBe(40);
  expect(result.seats.filter((seat) => !seat.offered).map((seat) => seat.label)).toEqual([1, 42]);
  expect(result.seats.find((seat) => seat.label === 2).offered).toBe(true);
  expect(createBusSeatConfiguration(metadata, base).capacity).toBe(42);
  expect(base.capacity).toBe(42);
  expect(base.decks[0].elements[0].label).toBe(1);
});

test.each(createBaseSeatLayouts())(
  'selecciona base $id y conserva pisos y numeración',
  (layout) => {
    const result = createBusSeatConfiguration({ ...metadata, seatLayoutId: layout.id }, layout);
    expect(result.capacity).toBe(layout.capacity);
    expect(result.seats.map((seat) => seat.label).sort((a, b) => a - b)).toEqual(
      Array.from({ length: layout.capacity }, (_, index) => index + 1),
    );
    expect(result.seats.filter((seat) => seat.deck === 2)).toHaveLength(
      layout.decks.length === 1 ? 0 : layout.id.endsWith('2_1') ? 34 : 44,
    );
  },
);

test.each(['deck-1-10-4', 'unknown', '1'])(
  'rechaza servicio, posición inexistente o etiqueta como clave: %s',
  (key) => {
    expect(() =>
      createBusSeatConfiguration({ ...metadata, disabledSeatKeys: [key] }, base),
    ).toThrow(BusRegistrationValidationError);
  },
);

test('rechaza todas las posiciones deshabilitadas y permite conservar solo una', () => {
  const keys = base.decks[0].elements
    .filter((entry) => entry.kind === 'SEAT')
    .map((seat) => seat.key);
  expect(() => createBusSeatConfiguration({ ...metadata, disabledSeatKeys: keys }, base)).toThrow(
    BusRegistrationValidationError,
  );
  const result = createBusSeatConfiguration({ ...metadata, disabledSeatKeys: keys.slice(1) }, base);
  expect(result.capacity).toBe(1);
  expect(result.seats.filter((seat) => seat.offered).map((seat) => seat.label)).toEqual([1]);
});

test.each([null, undefined, createBaseSeatLayouts()[1], { ...base, version: 2 }])(
  'rechaza base o versión no disponible',
  (layout) => {
    expect(() => createBusSeatConfiguration(metadata, layout)).toThrow(BusSeatLayoutNotFoundError);
  },
);

test('fallo geométrico del proveedor no se disfraza como plantilla ausente', () => {
  expect(() => createBusSeatConfiguration(metadata, { ...base, capacity: 999 })).toThrow(
    InvalidSeatLayoutError,
  );
});

test('snapshot y asientos son copias inmutables de datos del servidor', () => {
  const supplied = JSON.parse(JSON.stringify(base));
  const result = createBusSeatConfiguration(metadata, supplied);
  supplied.decks[0].elements[0].label = 999;
  expect(result.layout.decks[0].elements[0].label).toBe(1);
  expect(() => {
    result.seats[0].offered = false;
  }).toThrow(TypeError);
  expect(() => {
    result.layout.decks.pop();
  }).toThrow(TypeError);
  expect(() => {
    result.seats.pop();
  }).toThrow(TypeError);
});

test('marca como VIP solo las posiciones indicadas y no altera capacidad ni plantilla', () => {
  const result = createBusSeatConfiguration(
    { ...metadata, vipSeatKeys: ['deck-1-0-0', 'deck-1-0-1'] },
    base,
  );
  const vip = result.seats.filter((seat) => seat.category === 'VIP');
  expect(vip.map((seat) => seat.layoutSeatKey)).toEqual(['deck-1-0-0', 'deck-1-0-1']);
  expect(result.capacity).toBe(42);
  expect(result.seats.filter((seat) => seat.category === 'NORMAL')).toHaveLength(40);
  expect(JSON.stringify(result.layout)).not.toContain('VIP');
});

test('sin vipSeatKeys el resultado es igual al de una lista vacía', () => {
  expect(createBusSeatConfiguration(metadata, base)).toEqual(
    createBusSeatConfiguration({ ...metadata, vipSeatKeys: [] }, base),
  );
});

test('rechaza una clave VIP que no existe en la plantilla', () => {
  expect(() =>
    createBusSeatConfiguration({ ...metadata, vipSeatKeys: ['deck-9-0-0'] }, base),
  ).toThrow(BusRegistrationValidationError);
});

test('un asiento VIP desactivado conserva su categoría y no se ofrece', () => {
  const { seats, capacity } = createBusSeatConfiguration(
    { ...metadata, disabledSeatKeys: ['deck-1-0-0'], vipSeatKeys: ['deck-1-0-0'] },
    base,
  );
  expect(seats[0]).toMatchObject({ category: 'VIP', offered: false });
  expect(capacity).toBe(41);
});
