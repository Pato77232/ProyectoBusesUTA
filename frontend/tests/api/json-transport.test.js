import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createJsonTransport } from '../../src/api/json-transport.js';
import { ApiError } from '../../src/api/api-error.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
function fixture(reply) {
  const calls = [];
  const send = createJsonTransport(async (url, options) => {
    calls.push({ url, ...options });
    if (reply instanceof Error) throw reply;
    return typeof reply === 'function' ? reply(options) : reply;
  });
  return { send, calls };
}
for (const status of [200, 201, 204]) {
  test(`devuelve null ante éxito vacío ${status}`, async () => {
    const { send } = fixture(new Response(status === 204 ? null : '', { status }));
    assert.equal(await send('/api/v1/health'), null);
  });
}
test('devuelve JSON y conserva las opciones de mismo origen', async () => {
  const { send, calls } = fixture(json({ status: 'ok' }));
  assert.deepEqual(await send('/api/v1/health?probe=1'), { status: 'ok' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/v1/health?probe=1');
  assert.equal(calls[0].credentials, 'same-origin');
  assert.equal(calls[0].cache, 'no-store');
  assert.equal(calls[0].redirect, 'error');
  assert.equal(calls[0].headers['X-CSRF-Token'], undefined);
});
test('HEAD no interpreta un cuerpo', async () => {
  const { send } = fixture(new Response('texto'));
  assert.equal(await send('/api/v1/health', { method: 'HEAD' }), null);
});
for (const reply of [
  new Response('<html>proxy</html>'),
  new Response('{', { headers: { 'Content-Type': 'application/json' } }),
]) {
  test('rechaza respuestas exitosas no JSON o mal formadas', async () => {
    const { send } = fixture(reply);
    await assert.rejects(send('/api/v1/health'), { code: 'RESPONSE_INVALID', status: 200 });
  });
}
for (const [status, code] of [
  [401, 'UNAUTHENTICATED'],
  [403, 'FORBIDDEN'],
  [429, 'TOO_MANY_ATTEMPTS'],
  [502, 'SERVER_ERROR'],
]) {
  test(`normaliza HTTP ${status} sin exponer HTML ni reintentar`, async () => {
    const { send, calls } = fixture(new Response('<html>interno</html>', { status }));
    await assert.rejects(send('/api/v1/health'), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, status);
      assert.equal(error.code, code);
      assert.doesNotMatch(error.message, /html|interno/);
      return true;
    });
    assert.equal(calls.length, 1);
  });
}
test('conserva el error de dominio y oculta los detalles de errores 500', async () => {
  const denied = fixture(
    json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos.' } }, 400),
  );
  await assert.rejects(denied.send('/api/v1/auth/me'), {
    code: 'VALIDATION_ERROR',
    status: 400,
    message: 'Datos inválidos.',
  });
  const failed = fixture(json({ error: { code: 'SQL_FAILURE', message: 'detalle interno' } }, 500));
  await assert.rejects(failed.send('/api/v1/health'), { code: 'SERVER_ERROR', status: 500 });
});
for (const [error, code] of [
  [new TypeError('detalle de red'), 'NETWORK_ERROR'],
  [new DOMException('abortado', 'AbortError'), 'REQUEST_ABORTED'],
]) {
  test(`normaliza ${code} sin reintentos`, async () => {
    const { send, calls } = fixture(error);
    await assert.rejects(send('/api/v1/health'), { code, status: 0 });
    assert.equal(calls.length, 1);
  });
}
test('respeta la cancelación con motivo personalizado', async () => {
  const controller = new AbortController();
  const { send } = fixture(() => {
    controller.abort(new Error('motivo privado'));
    throw controller.signal.reason;
  });
  await assert.rejects(send('/api/v1/health', { signal: controller.signal }), {
    code: 'REQUEST_ABORTED',
  });
});
test('serializa JSON y adjunta el CSRF recibido sin obtener otro token', async () => {
  const { send, calls } = fixture(new Response(null, { status: 204 }));
  await send('/api/v1/cooperatives', {
    method: 'POST',
    data: { name: 'QA' },
    csrfToken: 'token-ficticio',
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].headers['X-CSRF-Token'], 'token-ficticio');
  assert.equal(calls[0].headers['Content-Type'], 'application/json');
  assert.equal(calls[0].body, JSON.stringify({ name: 'QA' }));
});
test('rechaza JSON no serializable antes de enviar datos', async () => {
  const circular = {};
  circular.self = circular;
  const { send, calls } = fixture(json({}));
  await assert.rejects(send('/api/v1/cooperatives', { method: 'POST', data: circular }), {
    code: 'REQUEST_INVALID',
  });
  assert.equal(calls.length, 0);
});
