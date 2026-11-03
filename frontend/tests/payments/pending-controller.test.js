import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPendingController } from '../../src/payments/pending-controller.js';

test('no consulta comprobantes para otro rol', async () => {
  const calls = [];
  const states = [];
  const controller = createPendingController({
    client: {
      request: async (path) => {
        calls.push(path);
        return { user: { role: 'CUSTOMER' } };
      },
    },
    view: { render: (state) => states.push(state) },
  });
  await controller.load();
  assert.deepEqual(calls, ['/api/v1/auth/me']);
  assert.equal(states.at(-1).mode, 'denied');
});

test('pagina con cursor codificado y sin cooperativa del navegador', async () => {
  const calls = [];
  const states = [];
  const controller = createPendingController({
    client: {
      request: async (path) => {
        calls.push(path);
        return path.endsWith('/me')
          ? { user: { role: 'CLERK' } }
          : { items: [], nextCursor: 'a+/=' };
      },
    },
    view: { render: (state) => states.push(state) },
  });
  await controller.load();
  await controller.load(true);
  assert.equal(calls.at(-1), '/api/v1/payment-proofs?cursor=a%2B%2F%3D');
  assert.equal(states.at(-1).mode, 'ready');
});

test('un fallo de lectura no se muestra como bandeja vacía', async () => {
  const states = [];
  const controller = createPendingController({
    client: {
      request: async () => {
        throw { status: 503 };
      },
    },
    view: { render: (state) => states.push(state) },
  });
  await controller.load();
  assert.equal(states.at(-1).mode, 'error');
});
