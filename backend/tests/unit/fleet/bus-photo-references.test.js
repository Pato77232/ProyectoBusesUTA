'use strict';

const { randomUUID } = require('node:crypto');
const {
  createBusPhotoReferences,
} = require('../../../src/modules/fleet/domain/bus-photo-references');
const {
  BusRegistrationValidationError,
} = require('../../../src/modules/fleet/domain/bus-registration-error');

const photo = () => ({ fileKey: randomUUID(), contentType: 'image/jpeg', size: 100 });

test('admite diez referencias, tamaño exacto máximo y orden derivado, sin contenido binario', () => {
  const input = Array.from({ length: 10 }, photo);
  input[0].size = 5_000_000;
  input[1].contentType = 'image/png';
  input[0].fileKey = input[0].fileKey.toUpperCase();
  const result = createBusPhotoReferences(input);
  expect(result.map((entry) => entry.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(result[0].size).toBe(5_000_000);
  expect(result[0].fileKey).toBe(input[0].fileKey.toLowerCase());
  expect(result[1].contentType).toBe('image/png');
  input[0].size = 1;
  expect(result[0].size).toBe(5_000_000);
  expect(() => {
    result[0].size = 2;
  }).toThrow(TypeError);
  expect(() => {
    result.pop();
  }).toThrow(TypeError);
});

test.each([null, [], {}, Array.from({ length: 11 }, photo)])(
  'rechaza cantidad o estructura inválida',
  (input) => {
    expect(() => createBusPhotoReferences(input)).toThrow(BusRegistrationValidationError);
  },
);

test.each([
  { size: 0 },
  { size: -1 },
  { size: 0.5 },
  { size: '100' },
  { size: 5_000_001 },
  { contentType: 'application/pdf' },
  { fileKey: '../other.jpg' },
  { fileKey: null },
  { order: 2 },
  { originalName: 'private.jpg' },
])('rechaza referencia inválida %j', (change) => {
  expect(() => createBusPhotoReferences([{ ...photo(), ...change }])).toThrow(
    BusRegistrationValidationError,
  );
});

test('rechaza claves repetidas incluso con diferente capitalización', () => {
  const first = photo();
  expect(() =>
    createBusPhotoReferences([first, { ...first, fileKey: first.fileKey.toUpperCase() }]),
  ).toThrow(BusRegistrationValidationError);
});
