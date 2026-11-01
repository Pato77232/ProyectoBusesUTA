'use strict';

const {
  createBusRegistrationData,
  formatBusPlate,
  assertBusGroupOwnership,
} = require('../../../src/modules/fleet/domain/bus-registration');
const {
  BusRegistrationValidationError,
  BusGroupNotFoundError,
} = require('../../../src/modules/fleet/domain/bus-registration-error');

const GROUP_ID = 'a71451ae-b125-4274-a583-15dfe4999201';
const COOPERATIVE_ID = '9ae0211a-7848-48d4-8e7b-5a36554f0ca1';
const valid = {
  plate: ' TBM-0013 ',
  vin: ' vin de prueba ',
  unitNumber: '01',
  bodyworkBrand: '  Marca de prueba  ',
  color: '  Azul y blanco  ',
  busGroupId: GROUP_ID,
  seatLayoutId: 'SINGLE_DECK_2_2',
  seatLayoutVersion: 1,
};

test('normaliza identificadores sin perder ceros de placa y preserva texto libre', () => {
  expect(createBusRegistrationData(valid)).toEqual({
    plate: 'TBM0013',
    vin: 'VIN DE PRUEBA',
    unitNumber: 1,
    bodyworkBrand: 'Marca de prueba',
    color: 'Azul y blanco',
    busGroupId: GROUP_ID,
    seatLayoutId: 'SINGLE_DECK_2_2',
    seatLayoutVersion: 1,
    disabledSeatKeys: [],
  });
});

test.each(['TBM-2213', 'tbm2213', ' tbm-2213 ', 'TBM2213'])(
  'unifica la placa %s y devuelve presentación con guion',
  (plate) => {
    expect(createBusRegistrationData({ ...valid, plate }).plate).toBe('TBM2213');
    expect(formatBusPlate(plate)).toBe('TBM-2213');
  },
);

test.each([1, '1', '01', ' 0001 '])('unifica la unidad %j', (unitNumber) => {
  expect(createBusRegistrationData({ ...valid, unitNumber }).unitNumber).toBe(1);
});

test('acepta el límite de precisión sin imponer un máximo operativo adicional', () => {
  expect(
    createBusRegistrationData({ ...valid, unitNumber: String(Number.MAX_SAFE_INTEGER) }).unitNumber,
  ).toBe(Number.MAX_SAFE_INTEGER);
});

test('VIN se normaliza sin inventar longitud, formato o consulta externa', () => {
  expect(createBusRegistrationData({ ...valid, vin: '  ab c-12  ' }).vin).toBe('AB C-12');
});

test('copia y congela metadatos y claves sin mutar entrada', () => {
  const input = { ...valid, disabledSeatKeys: ['deck-1-0-0'] };
  const result = createBusRegistrationData(input);
  input.disabledSeatKeys.push('deck-1-0-1');
  expect(result.disabledSeatKeys).toEqual(['deck-1-0-0']);
  expect(input.plate).toBe(' TBM-0013 ');
  expect(() => {
    result.plate = 'OTHER';
  }).toThrow(TypeError);
  expect(() => {
    result.disabledSeatKeys.push('other');
  }).toThrow(TypeError);
});

const invalidFields = [
  ['plate', 'TB-2213'],
  ['plate', 'TBMM-2213'],
  ['plate', 'TBM-123'],
  ['plate', 'TBM-12345'],
  ['plate', 'TBM--2213'],
  ['plate', 'TB-M2213'],
  ['plate', 'TBM 2213'],
  ['plate', 'TBM_2213'],
  ['plate', 2213],
  ['plate', 'ÑBM-2213'],
  ['vin', ' '],
  ['vin', null],
  ['vin', 123],
  ['unitNumber', 0],
  ['unitNumber', -1],
  ['unitNumber', 1.5],
  ['unitNumber', true],
  ['unitNumber', null],
  ['unitNumber', '1.0'],
  ['unitNumber', '1e2'],
  ['unitNumber', '+1'],
  ['unitNumber', '1x'],
  ['unitNumber', '1 2'],
  ['unitNumber', ''],
  ['unitNumber', Number.MAX_SAFE_INTEGER + 1],
  ['unitNumber', '9007199254740993'],
  ['bodyworkBrand', ' '],
  ['color', null],
  ['color', 123],
  ['busGroupId', 'not-uuid'],
  ['busGroupId', null],
  ['seatLayoutId', ' '],
  ['seatLayoutVersion', '1'],
  ['seatLayoutVersion', 0],
  ['seatLayoutVersion', 1.5],
  ['disabledSeatKeys', null],
  ['disabledSeatKeys', '1'],
  ['disabledSeatKeys', [1]],
  ['disabledSeatKeys', [' ']],
  ['disabledSeatKeys', ['deck-1-0-0', 'deck-1-0-0']],
];

test.each(invalidFields)('rechaza %s = %j', (field, value) => {
  expect(() => createBusRegistrationData({ ...valid, [field]: value })).toThrow(
    BusRegistrationValidationError,
  );
});

test.each([
  'id',
  'cooperative_id',
  'cooperativeId',
  'capacity',
  'photos',
  'seats',
  'role',
  'filePath',
])('rechaza propiedad ajena %s', (field) => {
  expect(() => createBusRegistrationData({ ...valid, [field]: 'injected' })).toThrow(
    BusRegistrationValidationError,
  );
});

test.each(Object.keys(valid))('rechaza ausencia de %s', (field) => {
  const input = { ...valid };
  delete input[field];
  expect(() => createBusRegistrationData(input)).toThrow(BusRegistrationValidationError);
});

test.each([null, [], {}, 'data'])('rechaza metadatos sin estructura %j', (input) => {
  expect(() => createBusRegistrationData(input)).toThrow(BusRegistrationValidationError);
});

test('comprueba grupo e identidad de cooperativa verificados por servidor', () => {
  expect(() =>
    assertBusGroupOwnership(
      { id: GROUP_ID, cooperative_id: COOPERATIVE_ID },
      COOPERATIVE_ID,
      GROUP_ID,
    ),
  ).not.toThrow();
});

test('rechaza contexto ausente aunque coincida con un grupo incompleto', () => {
  expect(() => assertBusGroupOwnership({}, undefined, undefined)).toThrow(BusGroupNotFoundError);
  expect(() => assertBusGroupOwnership({ id: GROUP_ID }, undefined, GROUP_ID)).toThrow(
    BusGroupNotFoundError,
  );
});

test.each([
  null,
  { id: GROUP_ID, cooperative_id: 'other' },
  { id: 'other', cooperative_id: COOPERATIVE_ID },
  {},
])('grupo ausente o ajeno no revela datos: %j', (group) => {
  try {
    assertBusGroupOwnership(group, COOPERATIVE_ID, GROUP_ID);
    throw new Error('Se esperaba rechazo');
  } catch (error) {
    expect(error).toBeInstanceOf(BusGroupNotFoundError);
    expect(error.code).toBe('BUS_GROUP_NOT_FOUND');
    expect(error.message).toBe('El grupo de buses no está disponible.');
  }
});
