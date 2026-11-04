const { createFrequency } = require('../../../src/modules/frequencies/domain/frequency');
const {
  FrequencyValidationError,
  FrequencyRequiresAntResolutionError,
  FrequencySegmentPricesMismatchError,
} = require('../../../src/modules/frequencies/domain/frequency-error');

const valid = {
  origin: 'Ambato',
  destination: 'Quito',
  departure_time: '14:00',
  ant_resolution_number: 'ANT-2026-000123',
  segment_prices: [8.5],
};

test('normaliza textos, aplica ACTIVE por defecto y deja la ruta directa sin paradas', () => {
  // Arrange
  const input = {
    ...valid,
    origin: '  Ambato ',
    destination: ' Quito  ',
    ant_resolution_number: ' ANT-2026-000123 ',
  };

  // Act
  const frequency = createFrequency(input);

  // Assert
  expect(frequency).toEqual({
    origin: 'Ambato',
    destination: 'Quito',
    departure_time: '14:00',
    ant_resolution_number: 'ANT-2026-000123',
    status: 'ACTIVE',
    stops: [],
    segment_prices: [8.5],
  });
});

test('congela la frecuencia y sus listas: origen, destino y hora no se modifican (RN-20)', () => {
  // Arrange
  const frequency = createFrequency(valid);

  // Act / Assert
  expect(Object.isFrozen(frequency)).toBe(true);
  expect(Object.isFrozen(frequency.stops)).toBe(true);
  expect(Object.isFrozen(frequency.segment_prices)).toBe(true);
  expect(() => {
    'use strict';
    frequency.origin = 'Riobamba';
  }).toThrow(TypeError);
  expect(frequency.origin).toBe('Ambato');
});

test('conserva las paradas y los precios de tramo en el orden recibido', () => {
  // Arrange
  const input = {
    ...valid,
    stops: ['Latacunga', 'Riobamba', 'Cuenca'],
    segment_prices: [1.5, 2, 3.25, 4],
  };

  // Act
  const frequency = createFrequency(input);

  // Assert
  expect(frequency.stops).toEqual(['Latacunga', 'Riobamba', 'Cuenca']);
  expect(frequency.segment_prices).toEqual([1.5, 2, 3.25, 4]);
});

test.each([
  null,
  undefined,
  [],
  'Ambato-Quito',
  { ...valid, id: 'elegido-por-el-cliente' },
  { ...valid, created_at: '2026-01-01' },
])('rechaza entradas que no son un objeto de frecuencia válido: %j', (input) => {
  // Arrange / Act / Assert
  expect(() => createFrequency(input)).toThrow(FrequencyValidationError);
});

test('ignora el cooperative_id del cuerpo: lo toma el servidor de la sesión (RN-02)', () => {
  // Arrange
  const input = { ...valid, cooperative_id: 'otra-cooperativa' };

  // Act
  const frequency = createFrequency(input);

  // Assert
  expect(frequency.cooperative_id).toBeUndefined();
});

test.each([undefined, null, '', '   '])(
  'rechaza la frecuencia sin resolución ANT cuando llega ausente o vacía: %j (RN-21)',
  (antResolutionNumber) => {
    // Arrange
    const input = { ...valid, ant_resolution_number: antResolutionNumber };

    // Act / Assert
    expect(() => createFrequency(input)).toThrow(FrequencyRequiresAntResolutionError);
  },
);

test.each([123456789, { text: 'ANT-1' }, ['ANT-1'], true])(
  'rechaza la resolución ANT que no es texto: %j',
  (antResolutionNumber) => {
    // Arrange
    const input = { ...valid, ant_resolution_number: antResolutionNumber };

    // Act / Assert
    expect(() => createFrequency(input)).toThrow(FrequencyValidationError);
  },
);

test.each(['AC-1', 'Resolución 2026-05', '123456789'])(
  'acepta cualquier resolución ANT no vacía, sin patrón de formato: %s (RN-21)',
  (antResolutionNumber) => {
    // Arrange / Act
    const frequency = createFrequency({ ...valid, ant_resolution_number: antResolutionNumber });

    // Assert
    expect(frequency.ant_resolution_number).toBe(antResolutionNumber);
  },
);

test.each([{ origin: '' }, { origin: '   ' }, { destination: null }, { destination: 42 }])(
  'rechaza origen o destino vacíos o no textuales: %j',
  (override) => {
    // Arrange / Act / Assert
    expect(() => createFrequency({ ...valid, ...override })).toThrow(FrequencyValidationError);
  },
);

test.each(['ambato', ' Ambato ', 'AMBATO'])(
  'rechaza la frecuencia con origen igual al destino (%s)',
  (destination) => {
    // Arrange / Act / Assert
    expect(() => createFrequency({ ...valid, destination })).toThrow(FrequencyValidationError);
  },
);

test.each(['25:00', '14:60', '24:00', '14', '9:5', '', 1400, null])(
  'rechaza la hora de salida inválida: %j',
  (departureTime) => {
    // Arrange
    const input = { ...valid, departure_time: departureTime };

    // Act / Assert
    expect(() => createFrequency(input)).toThrow(FrequencyValidationError);
  },
);

test.each([[' 9:05 ', '09:05'], ['14:00', '14:00'], ['0:00', '00:00'], ['23:59', '23:59']])(
  'normaliza la hora de salida a dos cifras: %s',
  (departureTime, expected) => {
    // Arrange / Act
    const frequency = createFrequency({ ...valid, departure_time: departureTime });

    // Assert
    expect(frequency.departure_time).toBe(expected);
  },
);

test.each(['CANCELLED', 'active', 'ACTIVA', '', 5])(
  'rechaza el estado fuera de ACTIVE e INACTIVE: %j (RN-23)',
  (status) => {
    // Arrange / Act / Assert
    expect(() => createFrequency({ ...valid, status })).toThrow(FrequencyValidationError);
  },
);

test('acepta INACTIVE y trata status nulo como ausente', () => {
  // Arrange / Act / Assert
  expect(createFrequency({ ...valid, status: 'INACTIVE' }).status).toBe('INACTIVE');
  expect(createFrequency({ ...valid, status: null }).status).toBe('ACTIVE');
});

test.each([
  { stops: 'Latacunga' },
  { stops: [''] },
  { stops: ['   '] },
  { stops: [7] },
  { stops: ['Latacunga', 'latacunga'] },
  { stops: ['Latacunga', 'LATACUNGA'] },
  { stops: ['ambato'] },
  { stops: ['Quito '] },
])('rechaza paradas inválidas, repetidas o iguales al origen o destino: %j (RN-22)', (override) => {
  // Arrange
  const input = { ...valid, segment_prices: [1, 2, 3], ...override };

  // Act / Assert
  expect(() => createFrequency(input)).toThrow(FrequencyValidationError);
});

test('admite varias paradas sin límite de cantidad', () => {
  // Arrange
  const stops = Array.from({ length: 12 }, (name, index) => `Parada ${index + 1}`);
  const input = { ...valid, stops, segment_prices: Array.from({ length: 13 }, () => 1) };

  // Act
  const frequency = createFrequency(input);

  // Assert
  expect(frequency.stops).toHaveLength(12);
  expect(frequency.segment_prices).toHaveLength(13);
});

test.each([
  { segment_prices: undefined },
  { segment_prices: null },
  { segment_prices: [] },
  { segment_prices: [1, 2] },
  { segment_prices: 8.5 },
  { stops: ['Latacunga'], segment_prices: [1] },
  { stops: ['Latacunga'], segment_prices: [1, 2, 3] },
])('exige exactamente un precio por tramo: %j', (override) => {
  // Arrange
  const input = { ...valid, ...override };

  // Act / Assert
  expect(() => createFrequency(input)).toThrow(FrequencySegmentPricesMismatchError);
});

test.each([0, -1, '8.50', NaN, Infinity, 1.005, 12.345, 100000000])(
  'rechaza el monto de tramo inválido: %j',
  (amount) => {
    // Arrange
    const input = { ...valid, segment_prices: [amount] };

    // Act / Assert
    expect(() => createFrequency(input)).toThrow(FrequencyValidationError);
  },
);

test.each([0.01, 8.5, 99999999.99])('acepta montos con hasta dos decimales: %s', (amount) => {
  // Arrange / Act
  const frequency = createFrequency({ ...valid, segment_prices: [amount] });

  // Assert
  expect(frequency.segment_prices).toEqual([amount]);
});
