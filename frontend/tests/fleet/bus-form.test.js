import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_BUS_PHOTOS,
  MAX_BUS_PHOTO_BYTES,
  buildBusData,
  formatPhotoSize,
  seatsByDeck,
  validateBusFields,
  validatePhotos,
} from '../../src/fleet/bus-form.js';

const VALID = {
  plate: 'tbm-2213',
  vin: ' 9BWZZZ377VT004251 ',
  unitNumber: '07',
  bodyworkBrand: ' Imetam ',
  color: ' Blanco ',
  busGroupId: '11111111-1111-4111-8111-111111111111',
  seatLayoutId: 'SINGLE_DECK_2_2',
};
const photo = (overrides = {}) => ({ name: 'bus.png', type: 'image/png', size: 100, ...overrides });
const LAYOUT = {
  id: 'DOUBLE_DECK_2_2',
  version: 3,
  decks: [
    {
      number: 2,
      elements: [
        { kind: 'SEAT', key: 'd2-s10', label: 10 },
        { kind: 'AISLE', key: 'd2-a1' },
        { kind: 'SEAT', key: 'd2-s2', label: 2 },
      ],
    },
    { number: 1, elements: [{ kind: 'SEAT', key: 'd1-s45', label: 45 }] },
  ],
};

test('acepta datos completos sin importar mayúsculas de la placa', () => {
  assert.deepEqual(validateBusFields(VALID), {});
  assert.deepEqual(validateBusFields({ ...VALID, plate: 'TBM2213' }), {});
});

test('señala cada campo obligatorio ausente', () => {
  assert.deepEqual(
    Object.keys(validateBusFields({})).sort(),
    ['busGroupId', 'bodyworkBrand', 'color', 'plate', 'seatLayoutId', 'unitNumber', 'vin'].sort(),
  );
});

test('rechaza placas fuera del formato acordado', () => {
  for (const plate of ['TB-2213', 'TBM-221', 'TBM 2213', '1234567']) {
    assert.ok(validateBusFields({ ...VALID, plate }).plate, plate);
  }
});

test('rechaza unidades que no son enteros positivos', () => {
  for (const unitNumber of ['0', '-1', '1.5', 'A1', '', '9007199254740993']) {
    assert.ok(validateBusFields({ ...VALID, unitNumber }).unitNumber, unitNumber);
  }
});

test('no impone patrón ni longitud al chasis', () => {
  assert.equal(validateBusFields({ ...VALID, vin: 'x' }).vin, undefined);
});

test('exige entre una y diez fotografías', () => {
  assert.match(validatePhotos([]), /al menos una/);
  assert.equal(validatePhotos(Array(MAX_BUS_PHOTOS).fill(photo())), null);
  assert.match(validatePhotos(Array(MAX_BUS_PHOTOS + 1).fill(photo())), /como máximo 10/);
});

test('exige que extensión y tipo coincidan', () => {
  assert.equal(validatePhotos([photo({ name: 'BUS.JPEG', type: 'image/jpeg' })]), null);
  for (const file of [
    photo({ name: 'bus.webp', type: 'image/webp' }),
    photo({ name: 'bus.png', type: 'image/jpeg' }),
    photo({ name: 'bus', type: 'image/png' }),
  ]) {
    assert.match(validatePhotos([file]), /JPEG o PNG/);
  }
});

test('aplica los límites de tamaño del alta', () => {
  assert.match(validatePhotos([photo({ size: 0 })]), /vacía/);
  assert.equal(validatePhotos([photo({ size: MAX_BUS_PHOTO_BYTES })]), null);
  assert.match(validatePhotos([photo({ size: MAX_BUS_PHOTO_BYTES + 1 })]), /5 MB/);
});

test('muestra el peso de la foto sin redondear a cero', () => {
  assert.equal(formatPhotoSize(2_048), '3 KB');
  assert.equal(formatPhotoSize(5_000_000), '5 MB');
});

test('agrupa solo asientos por piso, en orden de numeración', () => {
  assert.deepEqual(seatsByDeck(LAYOUT), [
    {
      number: 2,
      seats: [
        { key: 'd2-s2', label: 2 },
        { key: 'd2-s10', label: 10 },
      ],
    },
    { number: 1, seats: [{ key: 'd1-s45', label: 45 }] },
  ]);
});

test('agrega los asientos VIP elegidos sin compartir la lista recibida', () => {
  const vip = ['d2-s10'];
  const data = buildBusData(VALID, LAYOUT, [], vip);
  vip.push('d1-s45');
  assert.deepEqual(data.vipSeatKeys, ['d2-s10']);
});

test('sin asientos VIP omite el campo opcional', () => {
  assert.equal('vipSeatKeys' in buildBusData(VALID, LAYOUT, [], []), false);
});

test('arma el contrato del alta sin datos de cooperativa', () => {
  const data = buildBusData(VALID, LAYOUT, ['d2-s2']);
  assert.deepEqual(data, {
    plate: 'tbm-2213',
    vin: '9BWZZZ377VT004251',
    unitNumber: 7,
    bodyworkBrand: 'Imetam',
    color: 'Blanco',
    busGroupId: VALID.busGroupId,
    seatLayoutId: 'DOUBLE_DECK_2_2',
    seatLayoutVersion: 3,
    disabledSeatKeys: ['d2-s2'],
  });
});
