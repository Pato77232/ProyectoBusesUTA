import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPendingController } from '../../src/payments/pending-controller.js';

const user = { id: 'oficinista-A', role: 'CLERK', cooperative_id: 'cooperativa-A' };
const proof = {
  id: 'proof-1',
  bookingId: 'reserva-1',
  totalCents: 875,
  currency: 'USD',
  status: 'UPLOADED',
  fileName: 'comprobante.png',
  mediaType: 'image/png',
  fileSizeBytes: 70,
  uploadedAt: '2026-11-02T15:00:00.000Z',
};
function setup(request) {
  const states = [];
  const calls = [];
  const controller = createPendingController({
    client: {
      request: (path) => {
        calls.push(path);
        return request(path);
      },
    },
    view: { render: (state) => states.push(state) },
  });
  return { ...controller, calls, states };
}

test('sin sesión no consulta listado ni presenta vacío y permite recuperar sesión', async () => {
  let authenticated = false;
  const app = setup(async (path) => {
    if (!authenticated) throw { status: 401 };
    return path.endsWith('/me') ? { user } : { items: [], nextCursor: null };
  });
  await app.load();
  assert.equal(app.calls.length, 1);
  assert.equal(app.states.at(-1).needsLogin, true);
  authenticated = true;
  await app.retry();
  assert.equal(app.states.at(-1).mode, 'ready');
});

for (const role of ['CUSTOMER', 'COOPERATIVE_ADMIN', 'SUPER_ADMIN', undefined]) {
  test(`deniega rol ${role} antes del listado`, async () => {
    const app = setup(async () => ({ user: { ...user, role } }));
    await app.load();
    assert.equal(app.calls.length, 1);
    assert.equal(app.states.at(-1).mode, 'denied');
  });
}

test('pagina, vuelve y actualiza la página actual', async () => {
  const app = setup(async (path) =>
    path.endsWith('/me')
      ? { user }
      : { items: [proof], nextCursor: path.includes('?') ? null : 'cursor+/=' },
  );
  await app.load();
  assert.equal(app.states.at(-1).hasPrevious, false);
  await app.load(true);
  assert.equal(app.states.at(-1).pageNumber, 2);
  assert.equal(app.states.at(-1).hasNext, false);
  await app.load();
  assert.equal(app.calls.at(-1), '/api/v1/payment-proofs?cursor=cursor%2B%2F%3D');
  await app.previous();
  assert.equal(app.calls.at(-1), '/api/v1/payment-proofs');
  assert.equal(app.states.at(-1).pageNumber, 1);
});

test('un cambio de cooperativa reinicia el cursor sin enviar identidad como filtro', async () => {
  let currentUser = user;
  const app = setup(async (path) =>
    path.endsWith('/me') ? { user: currentUser } : { items: [proof], nextCursor: 'cursor-A' },
  );
  await app.load();
  currentUser = { ...user, cooperative_id: 'cooperativa-B' };
  await app.load(true);
  assert.equal(app.calls.at(-1), '/api/v1/payment-proofs');
  assert.equal(app.states.at(-1).pageNumber, 1);
});

test('el reintento conserva la página solicitada tras fallo de red', async () => {
  let fail = true;
  const app = setup(async (path) => {
    if (path.endsWith('/me')) return { user };
    if (path.includes('?') && fail) throw { code: 'NETWORK_ERROR' };
    return { items: [proof], nextCursor: path.includes('?') ? null : 'siguiente' };
  });
  await app.load();
  await app.load(true);
  assert.equal(app.states.at(-1).mode, 'error');
  fail = false;
  await app.retry();
  assert.equal(app.calls.at(-1), '/api/v1/payment-proofs?cursor=siguiente');
  assert.equal(app.states.at(-1).pageNumber, 2);
});

test('doble clic no duplica consulta activa', async () => {
  let resolveSession;
  const app = setup((path) =>
    path.endsWith('/me')
      ? new Promise((resolve) => {
          resolveSession = resolve;
        })
      : { items: [], nextCursor: null },
  );
  const first = app.load();
  await app.load();
  await app.load(true);
  assert.equal(app.calls.length, 1);
  resolveSession({ user });
  await first;
  assert.equal(app.calls.length, 2);
});

for (const [field, value] of [
  ['id', '../archivo'],
  ['id', null],
  ['totalCents', null],
  ['totalCents', -1],
  ['totalCents', 1.5],
  ['currency', 'EUR'],
  ['status', 'APPROVED'],
  ['mediaType', 'text/html'],
  ['fileSizeBytes', 0],
  ['uploadedAt', 'ayer'],
  ['fileName', ''],
]) {
  test(`respuesta inválida de ${field} no fabrica datos`, async () => {
    const app = setup(async (path) =>
      path.endsWith('/me') ? { user } : { items: [{ ...proof, [field]: value }], nextCursor: null },
    );
    await app.load();
    assert.equal(app.states.at(-1).mode, 'error');
    assert.equal(app.states.at(-1).items, undefined);
  });
}

test('conserva texto remoto literal y proyecta solo campos necesarios', async () => {
  const name = '<img src=x onerror=alert(1)>.png';
  const app = setup(async (path) =>
    path.endsWith('/me')
      ? { user }
      : {
          items: [{ ...proof, fileName: name, file_key: 'privado', ownerId: 'secreto' }],
          nextCursor: null,
        },
  );
  await app.load();
  assert.equal(app.states.at(-1).items[0].fileName, name);
  assert.equal(app.states.at(-1).items[0].file_key, undefined);
  assert.equal(app.states.at(-1).items[0].ownerId, undefined);
});
