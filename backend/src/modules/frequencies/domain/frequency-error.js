/**
 * Errores de dominio del módulo de frecuencias.
 * `code` es el identificador que viaja al cliente con el formato único de error de la API.
 */
class FrequencyError extends Error {
  constructor(code) {
    super(code);
    this.name = 'FrequencyError';
    this.code = code;
  }
}

/** Faltó la resolución ANT o llegó vacía (RN-21). */
class FrequencyRequiresAntResolutionError extends FrequencyError {
  constructor() {
    super('FREQUENCY_REQUIRES_ANT_RESOLUTION');
    this.name = 'FrequencyRequiresAntResolutionError';
  }
}

/** La cantidad de precios no coincide con la cantidad de tramos de la ruta. */
class FrequencySegmentPricesMismatchError extends FrequencyError {
  constructor() {
    super('FREQUENCY_SEGMENT_PRICES_MISMATCH');
    this.name = 'FrequencySegmentPricesMismatchError';
  }
}

/** Ya existe una frecuencia con el mismo origen, destino y hora en la cooperativa. */
class FrequencyAlreadyExistsError extends FrequencyError {
  constructor() {
    super('FREQUENCY_ALREADY_EXISTS');
    this.name = 'FrequencyAlreadyExistsError';
  }
}

/** La frecuencia no existe o pertenece a otra cooperativa (RN-02). */
class FrequencyNotFoundError extends FrequencyError {
  constructor() {
    super('FREQUENCY_NOT_FOUND');
    this.name = 'FrequencyNotFoundError';
  }
}

/** Datos de entrada inválidos. */
class FrequencyValidationError extends FrequencyError {
  constructor() {
    super('VALIDATION_ERROR');
    this.name = 'FrequencyValidationError';
  }
}

module.exports = {
  FrequencyError,
  FrequencyValidationError,
  FrequencyRequiresAntResolutionError,
  FrequencySegmentPricesMismatchError,
  FrequencyAlreadyExistsError,
  FrequencyNotFoundError,
};
