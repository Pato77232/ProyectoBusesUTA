const { createBusGroupData, CATEGORIES } = require('../../../src/modules/fleet/domain/bus-group');
const BusGroupError = require('../../../src/modules/fleet/domain/bus-group-error');

const valid = { name: 'Rutas largas', category: 'LONG_ROUTE' };

test('normaliza name y category', () => {
  expect(createBusGroupData({ name: '  Rutas largas  ', category: '  LONG_ROUTE  ' })).toEqual({
    name: 'Rutas largas',
    category: 'LONG_ROUTE',
  });
});

test('acepta las tres categorías de RN-11', () => {
  for (const category of CATEGORIES) {
    expect(createBusGroupData({ name: 'Grupo', category })).toMatchObject({ category });
  }
});

test.each([
  null,
  [],
  {},
  { ...valid, name: ' ' },
  { ...valid, category: 'OTRA' },
  { ...valid, category: 123 },
  { ...valid, name: 123 },
  { ...valid, extra: 'x' },
  { name: 'Grupo' },
  { category: 'LONG_ROUTE' },
])('rechaza datos inválidos: %j', (input) => {
  expect(() => createBusGroupData(input)).toThrow(BusGroupError);
  try {
    createBusGroupData(input);
  } catch (error) {
    expect(error.code).toBe('VALIDATION_ERROR');
  }
});
