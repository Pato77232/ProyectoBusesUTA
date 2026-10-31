'use strict';

const listSeatLayouts = require('../../../src/modules/fleet/application/list-seat-layouts.use-case');
const StaticSeatLayoutCatalog = require('../../../src/modules/fleet/infrastructure/static-seat-layout-catalog');
const { SeatLayoutCatalog } = require('../../../src/modules/fleet/domain/seat-layout-catalog');
const {
  createBaseSeatLayouts,
} = require('../../../src/modules/fleet/infrastructure/seat-layout-bases');
const { InvalidSeatLayoutError } = require('../../../src/modules/fleet/domain/seat-layout');

const copy = (value) => JSON.parse(JSON.stringify(value));

test('ordena las tres bases, valida copias y no modifica los datos del proveedor', async () => {
  const data = copy(createBaseSeatLayouts()).reverse();
  const before = copy(data);
  const catalog = { list: jest.fn().mockResolvedValue(data) };
  const result = await listSeatLayouts({ catalog })();
  expect(result.map((entry) => entry.id)).toEqual([
    'SINGLE_DECK_2_2',
    'DOUBLE_DECK_2_2',
    'DOUBLE_DECK_2_1',
  ]);
  expect(catalog.list).toHaveBeenCalledWith();
  expect(catalog.list).toHaveBeenCalledTimes(1);
  expect(data).toEqual(before);
  data[2].decks[0].elements[0].label = 999;
  expect(result[0].decks[0].elements[0].label).toBe(1);
  expect(() => {
    result.pop();
  }).toThrow(TypeError);
});

test('el catálogo concreto cumple el puerto y conserva claves entre lecturas', async () => {
  const catalog = new StaticSeatLayoutCatalog();
  expect(catalog).toBeInstanceOf(SeatLayoutCatalog);
  const query = listSeatLayouts({ catalog });
  const first = await query();
  expect(await query()).toEqual(first);
  expect(first.map((entry) => entry.capacity)).toEqual([42, 60, 46]);
  await expect(new SeatLayoutCatalog().list()).rejects.toThrow('debe implementarse');
});

test('propaga errores sin sustituirlos por un catálogo vacío', async () => {
  const failure = new Error('Proveedor no disponible');
  const catalog = { list: jest.fn().mockRejectedValue(failure) };
  await expect(listSeatLayouts({ catalog })()).rejects.toBe(failure);
});

test.each([null, [], {}, createBaseSeatLayouts().slice(1)])(
  'rechaza catálogo incompleto o inválido %j',
  async (data) => {
    await expect(listSeatLayouts({ catalog: { list: async () => data } })()).rejects.toBeInstanceOf(
      InvalidSeatLayoutError,
    );
  },
);

test.each(['duplicate', 'unknown', 'geometry'])(
  'rechaza %s en el catálogo sin respuesta parcial',
  async (change) => {
    const data = copy(createBaseSeatLayouts());
    if (change === 'duplicate') data[1].id = data[0].id;
    if (change === 'unknown') data[1].id = 'OTHER';
    if (change === 'geometry') data[1].capacity = 999;
    await expect(listSeatLayouts({ catalog: { list: async () => data } })()).rejects.toBeInstanceOf(
      InvalidSeatLayoutError,
    );
  },
);
