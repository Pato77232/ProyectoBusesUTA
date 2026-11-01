class BusUploadError extends Error {
  constructor(code = 'VALIDATION_ERROR') {
    const messages = {
      VALIDATION_ERROR: ['La carga del bus no es válida.', 400],
      PAYLOAD_TOO_LARGE: ['La carga supera el tamaño permitido.', 413],
      UNSUPPORTED_MEDIA_TYPE: ['Se requiere multipart/form-data.', 415],
    };
    super(messages[code][0]);
    this.name = 'BusUploadError';
    this.code = code;
    this.httpStatus = messages[code][1];
  }
}

module.exports = BusUploadError;
