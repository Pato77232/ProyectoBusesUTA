import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCsrfCache } from '../../src/api/csrf-cache.js';
import { ApiError } from '../../src/api/api-error.js';

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('obtiene el token una vez y lo reutiliza desde memoria', async () => {
  const calls = [];
  const cache = createCsrfCache(async (...args) => {
    calls.push(args);
    return { csrfToken: 'token-qa' };
  });
  assert.equal(await cache.getToken(), 'token-qa');
  assert.equal(await cache.getToken(), 'token-qa');
  assert.deepEqual(calls, [['/api/v1/auth/csrf', { signal: undefined }]]);
});

test('invalidar después de un cambio de sesión obliga a obtener otro token', async () => {
  let requests = 0;
  const cache = createCsrfCache(async () => ({
    csrfToken: `token-${++requests}`,
  }));
  assert.equal(await cache.getToken(), 'token-1');
  cache.invalidate();
  assert.equal(await cache.getToken(), 'token-2');
  assert.equal(requests, 2);
});

for (const result of [null, {}, { csrfToken: '' }, { csrfToken: '  ' }, { csrfToken: 123 }]) {
  test(`rechaza token inválido ${JSON.stringify(result)} sin guardarlo`, async () => {
    let requests = 0;
    const cache = createCsrfCache(async () =>
      ++requests === 1 ? result : { csrfToken: 'válido' },
    );
    await assert.rejects(cache.getToken(), { code: 'RESPONSE_INVALID' });
    assert.equal(await cache.getToken(), 'válido');
    assert.equal(requests, 2);
  });
}

test('propaga el fallo sin reintentar y permite una solicitud explícita posterior', async () => {
  const failure = new ApiError('NETWORK_ERROR', 'No se pudo conectar.');
  let requests = 0;
  const cache = createCsrfCache(async () => {
    if (++requests === 1) throw failure;
    return { csrfToken: 'renovado' };
  });
  await assert.rejects(cache.getToken(), (error) => error === failure);
  assert.equal(requests, 1);
  assert.equal(await cache.getToken(), 'renovado');
});

test('una cancelación previa no inicia transporte ni usa el token guardado', async () => {
  let requests = 0;
  const cache = createCsrfCache(async () => {
    requests++;
    return { csrfToken: 'qa' };
  });
  await cache.getToken();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(cache.getToken({ signal: controller.signal }), {
    code: 'REQUEST_ABORTED',
  });
  assert.equal(requests, 1);
});

test('propaga signal y no guarda una respuesta cancelada durante el transporte', async () => {
  const controller = new AbortController();
  let requests = 0;
  const cache = createCsrfCache(async (url, { signal }) => {
    requests++;
    if (requests === 1) {
      assert.equal(signal, controller.signal);
      controller.abort();
    }
    return { csrfToken: `token-${requests}` };
  });
  await assert.rejects(cache.getToken({ signal: controller.signal }), {
    code: 'REQUEST_ABORTED',
  });
  assert.equal(await cache.getToken(), 'token-2');
});

test('la respuesta de una sesión anterior no sobrescribe el token renovado', async () => {
  const old = deferred();
  let requests = 0;
  const cache = createCsrfCache(async () =>
    ++requests === 1 ? old.promise : { csrfToken: 'nuevo' },
  );
  const pending = cache.getToken();
  await Promise.resolve();
  cache.invalidate();
  const renewed = cache.getToken();
  const rejected = assert.rejects(pending, { code: 'CSRF_STATE_CHANGED' });
  await Promise.resolve();
  assert.equal(requests, 1);
  old.resolve({ csrfToken: 'anterior' });
  await rejected;
  assert.equal(await renewed, 'nuevo');
  assert.equal(await cache.getToken(), 'nuevo');
  assert.equal(requests, 2);
});

test('cada instancia mantiene su propia caché', async () => {
  const first = createCsrfCache(async () => ({ csrfToken: 'uno' }));
  const second = createCsrfCache(async () => ({ csrfToken: 'dos' }));
  assert.equal(await first.getToken(), 'uno');
  assert.equal(await second.getToken(), 'dos');
  first.invalidate();
  assert.equal(await second.getToken(), 'dos');
});

test('las solicitudes simultáneas comparten el token sin rotar cookies en paralelo', async () => {
  const response = deferred();
  let requests = 0;
  const cache = createCsrfCache(async () => {
    requests++;
    return response.promise;
  });
  const first = cache.getToken();
  const second = cache.getToken();
  await Promise.resolve();
  assert.equal(requests, 1);
  response.resolve({ csrfToken: 'compartido' });
  assert.deepEqual(await Promise.all([first, second]), ['compartido', 'compartido']);
  assert.equal(requests, 1);
});
