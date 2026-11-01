import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApiClient } from '../../src/api/api-client.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
function fixture(reply = () => json({ ok: true })) {
  const calls = [];
  let tokens = 0;
  const client = createApiClient({
    fetchImpl: async (path, options) => {
      calls.push({ path, ...options });
      if (path === '/api/v1/auth/csrf') return json({ csrfToken: `token-${++tokens}` });
      return reply(path, options);
    },
  });
  return { ...client, calls };
}

for (const method of ['GET', 'HEAD']) {
  test(`${method} conserva origen/cookies/signal sin obtener CSRF`, async () => {
    const { request, calls } = fixture();
    const signal = new AbortController().signal;
    await request('/api/v1/health?probe=1', { method, signal });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].credentials, 'same-origin');
    assert.equal(calls[0].cache, 'no-store');
    assert.equal(calls[0].redirect, 'error');
    assert.equal(calls[0].signal, signal);
    assert.equal(calls[0].headers['X-CSRF-Token'], undefined);
  });
}
for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
  test(`${method} obtiene CSRF y reutiliza el token en la siguiente mutación`, async () => {
    const { request, calls } = fixture();
    await request('/api/v1/cooperatives', { method: method.toLowerCase(), data: { name: 'QA' } });
    await request('/api/v1/cooperatives', { method });
    assert.equal(calls.length, 3);
    assert.equal(calls[1].method, method);
    assert.equal(calls[1].body, JSON.stringify({ name: 'QA' }));
    assert.equal(calls[1].headers['X-CSRF-Token'], 'token-1');
    assert.equal(calls[2].headers['X-CSRF-Token'], 'token-1');
  });
}
for (const path of [
  'https://example.com/api/v1/health',
  '//example.com/api/v1/health',
  '/api/v10/health',
  '/health',
  '/api/v1/../health',
  '/api/v1/%2e%2e/health',
  '/api/v1/%252e%252e/health',
  '/api/v1/a%2fb',
  '/api/v1/a%5cb',
  '/api/v1/a\\b',
  '/api/v1/health#fragment',
  '/api/v1/health\n',
  '/api/v1/%00',
  '/api/v1/%20',
  '/api/v1/%',
  null,
]) {
  test(`rechaza ruta insegura ${JSON.stringify(path)} antes de solicitar CSRF`, async () => {
    const { request, calls } = fixture();
    await assert.rejects(request(path, { method: 'POST' }), { code: 'REQUEST_INVALID' });
    assert.equal(calls.length, 0);
  });
}
for (const method of ['TRACE', 'CONNECT', '', ' POST', null, 7]) {
  test(`rechaza método inválido ${JSON.stringify(method)} sin hacer peticiones`, async () => {
    const { request, calls } = fixture();
    await assert.rejects(request('/api/v1/health', { method }), { code: 'REQUEST_INVALID' });
    assert.equal(calls.length, 0);
  });
}
for (const method of ['GET', 'HEAD']) {
  test(`rechaza cuerpo en ${method}`, async () => {
    const { request, calls } = fixture();
    await assert.rejects(request('/api/v1/health', { method, data: {} }), {
      code: 'REQUEST_INVALID',
    });
    assert.equal(calls.length, 0);
  });
}
for (const status of [200, 201, 204]) {
  test(`conserva éxito vacío ${status}`, async () => {
    const { request } = fixture(() => new Response(status === 204 ? null : '', { status }));
    assert.equal(await request('/api/v1/auth/register', { method: 'POST' }), null);
  });
}
for (const path of ['/api/v1/auth/login', '/api/v1/auth/logout/?probe=1']) {
  test(`renueva CSRF para la siguiente mutación tras ${path}`, async () => {
    const { request, calls } = fixture(() => new Response(null, { status: 204 }));
    await request(path, { method: 'POST' });
    await request('/api/v1/cooperatives', { method: 'POST' });
    assert.deepEqual(
      calls.map((call) => call.path),
      ['/api/v1/auth/csrf', path, '/api/v1/auth/csrf', '/api/v1/cooperatives'],
    );
    assert.equal(calls[3].headers['X-CSRF-Token'], 'token-2');
  });
}
for (const [status, code, renews] of [
  [401, 'UNAUTHENTICATED', true],
  [403, 'CSRF_TOKEN_INVALID', true],
  [403, 'FORBIDDEN', false],
  [429, 'TOO_MANY_ATTEMPTS', false],
  [500, 'SERVER_ERROR', false],
]) {
  test(`propaga ${code} sin repetir la mutación; invalidación=${renews}`, async () => {
    let operations = 0;
    const { request, calls } = fixture(() =>
      ++operations === 1
        ? json({ error: { code, message: 'Error QA.' } }, status)
        : json({ ok: true }),
    );
    await assert.rejects(request('/api/v1/cooperatives', { method: 'POST' }), { code, status });
    assert.equal(operations, 1);
    await request('/api/v1/cooperatives', { method: 'POST' });
    assert.equal(calls.at(-1).headers['X-CSRF-Token'], renews ? 'token-2' : 'token-1');
    assert.equal(operations, 2);
  });
}
for (const [reply, code] of [
  [
    () => {
      throw new TypeError('detalle privado');
    },
    'NETWORK_ERROR',
  ],
  [() => new Response('<html>proxy</html>'), 'RESPONSE_INVALID'],
  [() => new Response('interno', { status: 502 }), 'SERVER_ERROR'],
]) {
  test(`un cambio de sesión incierto ${code} descarta el token sin repetir`, async () => {
    let operations = 0;
    const { request, calls } = fixture(() => (++operations === 1 ? reply() : json({ ok: true })));
    await assert.rejects(request('/api/v1/auth/login', { method: 'POST' }), { code });
    assert.equal(operations, 1);
    await request('/api/v1/cooperatives', { method: 'POST' });
    assert.equal(calls.at(-1).headers['X-CSRF-Token'], 'token-2');
  });
}
test('pedir CSRF explícitamente invalida el token previamente guardado', async () => {
  const { request, calls } = fixture();
  await request('/api/v1/cooperatives', { method: 'POST' });
  assert.deepEqual(await request('/api/v1/auth/csrf'), { csrfToken: 'token-2' });
  await request('/api/v1/cooperatives', { method: 'POST' });
  assert.equal(calls.at(-1).headers['X-CSRF-Token'], 'token-3');
});
test('si falla obtener CSRF no envía la mutación', async () => {
  const calls = [];
  const { request } = createApiClient({
    fetchImpl: async (path) => {
      calls.push(path);
      return json({});
    },
  });
  await assert.rejects(request('/api/v1/cooperatives', { method: 'POST' }), {
    code: 'RESPONSE_INVALID',
  });
  assert.deepEqual(calls, ['/api/v1/auth/csrf']);
});
test('cancelar antes de una mutación impide obtener CSRF y enviarla', async () => {
  const { request, calls } = fixture();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    request('/api/v1/cooperatives', {
      method: 'POST',
      signal: controller.signal,
    }),
    { code: 'REQUEST_ABORTED' },
  );
  assert.equal(calls.length, 0);
});

test('GET por defecto ignora opciones que intentan cambiar cookies y cabeceras', async () => {
  const { request, calls } = fixture();
  assert.deepEqual(
    await request('/api/v1/health', {
      headers: { Authorization: 'no-usar', 'X-CSRF-Token': 'ajeno' },
      credentials: 'omit',
      cache: 'force-cache',
      redirect: 'follow',
      csrfToken: 'ajeno',
    }),
    { ok: true },
  );
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].credentials, 'same-origin');
  assert.equal(calls[0].cache, 'no-store');
  assert.equal(calls[0].redirect, 'error');
  assert.deepEqual(calls[0].headers, { Accept: 'application/json' });
});
for (const path of ['/api/v1/auth/login', '/api/v1/auth/logout']) {
  test(`cancelar durante ${path} invalida CSRF sin repetir la operación`, async () => {
    const controller = new AbortController();
    let operations = 0;
    const { request, calls } = fixture((url, { signal }) => {
      if (++operations === 1) {
        assert.equal(signal, controller.signal);
        controller.abort(new Error('motivo privado'));
        throw signal.reason;
      }
      return json({ ok: true });
    });
    await assert.rejects(request(path, { method: 'POST', signal: controller.signal }), {
      code: 'REQUEST_ABORTED',
    });
    assert.equal(operations, 1);
    await request('/api/v1/cooperatives', { method: 'POST' });
    assert.equal(calls.at(-1).headers['X-CSRF-Token'], 'token-2');
  });
}
for (const [path, status] of [
  ['/api/v1/auth/login', 400],
  ['/api/v1/auth/register', 201],
]) {
  test(`${path} con estado ${status} conserva el token de la sesión actual`, async () => {
    let operations = 0;
    const { request, calls } = fixture(() =>
      ++operations === 1
        ? json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos.' } }, status)
        : json({ ok: true }),
    );
    const operation = request(path, { method: 'POST' });
    if (status === 400) await assert.rejects(operation, { code: 'VALIDATION_ERROR' });
    else await operation;
    await request('/api/v1/cooperatives', { method: 'POST' });
    assert.equal(calls.at(-1).headers['X-CSRF-Token'], 'token-1');
    assert.equal(calls.length, 3);
  });
}
