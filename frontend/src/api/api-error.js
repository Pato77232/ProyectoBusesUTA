export class ApiError extends Error {
  constructor(code, message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export function connectionError(error) {
  return error?.name === 'AbortError'
    ? new ApiError('REQUEST_ABORTED', 'La solicitud fue cancelada.')
    : new ApiError('NETWORK_ERROR', 'No se pudo conectar. Comprueba tu conexión.');
}

export function httpError(status, body) {
  const defaults = {
    401: ['UNAUTHENTICATED', 'Sesión inválida o vencida.'],
    403: ['FORBIDDEN', 'Acceso no permitido.'],
    429: ['TOO_MANY_ATTEMPTS', 'Demasiados intentos. Intenta más tarde.'],
  };
  const fallback =
    status >= 500
      ? ['SERVER_ERROR', 'El servicio no está disponible. Intenta más tarde.']
      : defaults[status] || ['HTTP_ERROR', 'No se pudo completar la solicitud.'];
  const error = body?.error;
  const valid =
    status < 500 &&
    typeof error?.code === 'string' &&
    error.code.length > 0 &&
    typeof error.message === 'string' &&
    error.message.length > 0;
  return new ApiError(
    valid ? error.code : fallback[0],
    valid ? error.message : fallback[1],
    status,
  );
}
