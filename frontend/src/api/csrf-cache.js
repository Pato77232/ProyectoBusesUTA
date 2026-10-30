import { ApiError } from './api-error.js';

export function createCsrfCache(send) {
  let token;
  let generation = 0;
  let queue = Promise.resolve();

  function invalidate() {
    token = undefined;
    generation += 1;
  }

  function getToken({ signal } = {}) {
    const requestedGeneration = generation;
    const request = queue.then(() => loadToken(signal, requestedGeneration));
    queue = request.then(
      () => {},
      () => {},
    );
    return request;
  }

  async function loadToken(signal, requestedGeneration) {
    assertCurrentGeneration(requestedGeneration);
    if (signal?.aborted) {
      throw new ApiError('REQUEST_ABORTED', 'La solicitud fue cancelada.');
    }
    if (token) return token;
    const result = await send('/api/v1/auth/csrf', { signal });
    if (signal?.aborted) {
      throw new ApiError('REQUEST_ABORTED', 'La solicitud fue cancelada.');
    }
    assertCurrentGeneration(requestedGeneration);
    if (typeof result?.csrfToken !== 'string' || !result.csrfToken.trim()) {
      throw new ApiError('RESPONSE_INVALID', 'El servicio no devolvió un token CSRF válido.');
    }
    token = result.csrfToken;
    return token;
  }

  function assertCurrentGeneration(requestedGeneration) {
    if (requestedGeneration !== generation) {
      throw new ApiError('CSRF_STATE_CHANGED', 'La sesión cambió. Vuelve a intentar la acción.');
    }
  }

  return { getToken, invalidate };
}
