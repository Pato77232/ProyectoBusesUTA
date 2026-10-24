const {
  FrequencyError,
  FrequencyValidationError,
  FrequencyRequiresAntResolutionError,
  FrequencySegmentPricesMismatchError,
  FrequencyAlreadyExistsError,
  FrequencyNotFoundError,
} = require('../../../src/modules/frequencies/domain/frequency-error');

test.each([
  ['VALIDATION_ERROR', FrequencyValidationError],
  ['FREQUENCY_REQUIRES_ANT_RESOLUTION', FrequencyRequiresAntResolutionError],
  ['FREQUENCY_SEGMENT_PRICES_MISMATCH', FrequencySegmentPricesMismatchError],
  ['FREQUENCY_ALREADY_EXISTS', FrequencyAlreadyExistsError],
  ['FREQUENCY_NOT_FOUND', FrequencyNotFoundError],
])('el error %s es un error de dominio con su código y su nombre', (code, ErrorClass) => {
  // Arrange / Act
  const error = new ErrorClass();

  // Assert
  expect(error).toBeInstanceOf(FrequencyError);
  expect(error).toBeInstanceOf(Error);
  expect(error.code).toBe(code);
  expect(error.name).toBe(ErrorClass.name);
  expect(error.message).toBe(code);
});
