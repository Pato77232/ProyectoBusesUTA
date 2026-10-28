import { ApiError, connectionError, httpError } from './api-error.js';

const JSON_CONTENT_TYPE = /^application\/(?:[\w.-]+\+)?json(?:\s*;|$)/i;

export function createJsonTransport(fetchImpl) {
  return async function send(url, { method = 'GET', data, signal, csrfToken } = {}) {
    const headers = { Accept: 'application/json' };
    let body;
    if (data !== undefined) {
      try {
        body = JSON.stringify(data);
        if (body === undefined) throw new Error();
      } catch {
        throw new ApiError('REQUEST_INVALID', 'Los datos deben poder representarse como JSON.');
      }
      headers['Content-Type'] = 'application/json';
    }
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    let response;
    let text;
    try {
      response = await fetchImpl(url, {
        method,
        headers,
        body,
        signal,
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
      });
      text = method === 'HEAD' || response.status === 204 ? '' : await response.text();
    } catch (error) {
      throw connectionError(signal?.aborted ? { name: 'AbortError' } : error);
    }
    let parsed;
    const isJson = JSON_CONTENT_TYPE.test(response.headers.get('Content-Type') || '');
    if (text && isJson) {
      try {
        parsed = JSON.parse(text);
      } catch {
        /* Se informa abajo según el estado HTTP. */
      }
    }
    if (!response.ok) throw httpError(response.status, parsed);
    if (!text) return null;
    if (!isJson || parsed === undefined) {
      throw new ApiError(
        'RESPONSE_INVALID',
        'El servicio devolvió una respuesta no válida.',
        response.status,
      );
    }
    return parsed;
  };
}
