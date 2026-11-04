const errorHandler = require('../../../src/shared/middlewares/error-handler');
const DomainError = require('../../../src/shared/errors/domain-error');
const NotFoundError = require('../../../src/shared/errors/not-found-error');

function createResponse() {
  const res = { headersSent: false, statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
}

describe('errorHandler (middleware central de errores)', () => {
  it('traduce un DomainError al código HTTP y al formato únicos', () => {
    // Arrange
    const error = new DomainError('La frecuencia requiere resolución ANT.', 'FREQUENCY_REQUIRES_ANT', 422);
    const res = createResponse();
    const next = jest.fn();

    // Act
    errorHandler(error, {}, res, next);

    // Assert
    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({
      error: { code: 'FREQUENCY_REQUIRES_ANT', message: 'La frecuencia requiere resolución ANT.' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 404 con NOT_FOUND cuando recibe un NotFoundError', () => {
    // Arrange
    const res = createResponse();

    // Act
    errorHandler(new NotFoundError(), {}, res, jest.fn());

    // Assert
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Recurso no encontrado.' } });
  });

  it('responde 400 INVALID_JSON ante un cuerpo JSON malformado', () => {
    // Arrange
    const error = new SyntaxError('Unexpected token }');
    error.status = 400;
    error.body = '{ no-es-json';
    const res = createResponse();

    // Act
    errorHandler(error, {}, res, jest.fn());

    // Assert
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: { code: 'INVALID_JSON', message: 'El cuerpo JSON no es válido.' } });
  });

  it('responde 500 INTERNAL_ERROR sin exponer el stack ni el mensaje original', () => {
    // Arrange
    const error = new Error('detalle interno secreto con stack');
    const res = createResponse();

    // Act
    errorHandler(error, {}, res, jest.fn());

    // Assert
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor.' } });
    expect(JSON.stringify(res.body)).not.toContain('detalle interno secreto');
    expect(JSON.stringify(res.body)).not.toContain('stack');
  });

  it('delega al siguiente manejador cuando las cabeceras ya fueron enviadas', () => {
    // Arrange
    const error = new Error('tarde para responder');
    const res = createResponse();
    res.headersSent = true;
    const next = jest.fn();

    // Act
    errorHandler(error, {}, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(error);
    expect(res.body).toBeNull();
  });
});
