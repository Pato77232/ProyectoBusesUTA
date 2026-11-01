import { ApiError } from './api-error.js';
import { createCsrfCache } from './csrf-cache.js';
import { createJsonTransport } from './json-transport.js';

const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']);
const READ_METHODS = new Set(['GET', 'HEAD']);
const SESSION_PATHS = new Set(['/api/v1/auth/login', '/api/v1/auth/logout']);

function validateRequest(path, method, data) {
  const invalid = () => new ApiError('REQUEST_INVALID', 'La ruta o el método no son válidos.');
  if (
    typeof path !== 'string' ||
    !path.startsWith('/api/v1/') ||
    /[\s\\#\u0000-\u001f\u007f]/u.test(path)
  ) {
    throw invalid();
  }
  const pathname = path.split('?')[0];
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    throw invalid();
  }
  if (
    /%(?:2f|5c|25|3f|23)/i.test(pathname) ||
    /[\s\\\u0000-\u001f\u007f]/u.test(decoded) ||
    decoded.split('/').some((part) => part === '.' || part === '..')
  )
    throw invalid();
  if (typeof method !== 'string' || !METHODS.has(method.toUpperCase())) throw invalid();
  const normalizedMethod = method.toUpperCase();
  if (READ_METHODS.has(normalizedMethod) && data !== undefined) throw invalid();
  return { pathname: decoded.replace(/\/+$/, ''), method: normalizedMethod };
}

export function createApiClient({ fetchImpl = fetch } = {}) {
  const send = createJsonTransport(fetchImpl);
  const csrf = createCsrfCache(send);

  async function request(path, { method = 'GET', data, signal } = {}) {
    const validated = validateRequest(path, method, data);
    method = validated.method;
    const changesSession = method === 'POST' && SESSION_PATHS.has(validated.pathname);
    if (validated.pathname === '/api/v1/auth/csrf') csrf.invalidate();
    try {
      const csrfToken = READ_METHODS.has(method) ? undefined : await csrf.getToken({ signal });
      const result = await send(path, { method, data, signal, csrfToken });
      if (changesSession) csrf.invalidate();
      return result;
    } catch (error) {
      if (
        error.status === 401 ||
        error.code === 'CSRF_TOKEN_INVALID' ||
        (changesSession &&
          ['NETWORK_ERROR', 'REQUEST_ABORTED', 'RESPONSE_INVALID', 'SERVER_ERROR'].includes(
            error.code,
          ))
      ) {
        csrf.invalidate();
      }
      throw error;
    }
  }

  return { request };
}
