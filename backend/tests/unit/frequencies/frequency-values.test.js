const { createDepartureTime } = require('../../../src/modules/frequencies/domain/departure-time');
const {
  createFrequencyStatus,
  FREQUENCY_STATUSES,
} = require('../../../src/modules/frequencies/domain/frequency-status');
const { createStop, placeKey } = require('../../../src/modules/frequencies/domain/stop');
const { createSegmentPrice } = require('../../../src/modules/frequencies/domain/segment-price');
const {
  FrequencyValidationError,
} = require('../../../src/modules/frequencies/domain/frequency-error');

test.each([['9:05', '09:05'], ['09:05', '09:05'], ['0:00', '00:00'], ['23:59', '23:59']])(
  'la hora de salida se normaliza a HH:mm: %s',
  (value, expected) => {
    // Arrange / Act / Assert
    expect(createDepartureTime(value)).toBe(expected);
  },
);

test.each(['24:00', '23:60', '7:5', '0700', '', '   ', null, 900])(
  'la hora de salida inválida se rechaza: %j',
  (value) => {
    // Arrange / Act / Assert
    expect(() => createDepartureTime(value)).toThrow(FrequencyValidationError);
  },
);

test('el estado por defecto es ACTIVE y solo admite ACTIVE o INACTIVE (RN-23)', () => {
  // Arrange / Act / Assert
  expect(FREQUENCY_STATUSES).toEqual(['ACTIVE', 'INACTIVE']);
  expect(createFrequencyStatus(undefined)).toBe('ACTIVE');
  expect(createFrequencyStatus(null)).toBe('ACTIVE');
  expect(createFrequencyStatus('INACTIVE')).toBe('INACTIVE');
  expect(() => createFrequencyStatus('ACTIVA')).toThrow(FrequencyValidationError);
});

test('la parada se recorta y su clave ignora mayúsculas y espacios exteriores (RN-22)', () => {
  // Arrange / Act / Assert
  expect(createStop(' Latacunga ')).toBe('Latacunga');
  expect(placeKey(' Latacunga ')).toBe('latacunga');
  expect(() => createStop('   ')).toThrow(FrequencyValidationError);
  expect(() => createStop(5)).toThrow(FrequencyValidationError);
});

test.each([1, 0.01, 8.5, 12.75, 99999999.99])(
  'el precio de tramo admite montos positivos con hasta dos decimales: %s',
  (amount) => {
    // Arrange / Act / Assert
    expect(createSegmentPrice(amount)).toBe(amount);
  },
);

test.each([0, -0.01, '8.50', null, 1.005, 12.345, 100000000])(
  'el precio de tramo rechaza montos inválidos: %j',
  (amount) => {
    // Arrange / Act / Assert
    expect(() => createSegmentPrice(amount)).toThrow(FrequencyValidationError);
  },
);
