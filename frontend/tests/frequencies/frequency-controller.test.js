import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createFrequencyController } from '../../src/frequencies/frequency-controller.js';

const user = () => ({
  id: '10000000-0000-4000-8000-000000000001',
  cooperative_id: '20000000-0000-4000-8000-000000000001',
  role: 'COOPERATIVE_ADMIN',
});
const input = () => ({
  origin: 'Ambato',
  destination: 'Quito',
  departure_time: '00:00',
  ant_resolution_number: 'ANT-PRUEBA',
  status: 'ACTIVE',
  stops: ['Latacunga'],
  segment_prices: [2, 3],
});
function setup() {
  const state = {
    user: user(),
    calls: [],
    renders: [],
    resets: 0,
    error: null,
    post: null,
  };
  const client = {
    async request(path, options) {
      state.calls.push({ path, options });
      if (path.endsWith('/me')) return { user: state.user };
      if (state.error) throw state.error;
      if (state.post) return state.post(options.data);
      return {
        frequency: {
          id: '30000000-0000-4000-8000-000000000001',
          cooperative_id: user().cooperative_id,
          ...options.data,
        },
      };
    },
  };
  const controller = createFrequencyController({
    client,
    view: {
      render: (value) => state.renders.push(value),
      reset: () => state.resets++,
    },
  });
  return {
    state,
    client,
    controller,
    last: () => state.renders.at(-1),
    posts: () => state.calls.filter((call) => call.options?.method === 'POST'),
  };
}
test('comprueba sesión y revalida antes del POST; devuelve alta verificada sin tenant en body', async () => {
  const f = setup();
  await f.controller.checkSession();
  assert.equal(f.last().mode, 'ready');
  await f.controller.submit({ ...input(), cooperative_id: 'tenant-elegido' });
  assert.equal(f.last().mode, 'success');
  assert.equal(f.posts().length, 1);
  assert.deepEqual(f.posts()[0].options.data, input());
  assert.deepEqual(
    f.state.calls.map((call) => call.path),
    ['/api/v1/auth/me', '/api/v1/auth/me', '/api/v1/frequencies'],
  );
});
test('no permite enviar antes de verificar sesión', async () => {
  const f = setup();
  await f.controller.submit(input());
  assert.equal(f.posts().length, 0);
});
test('rol cliente no habilita el formulario ni POST', async () => {
  const f = setup();
  f.state.user = { ...user(), role: 'CUSTOMER', cooperative_id: null };
  await f.controller.checkSession();
  assert.equal(f.last().mode, 'forbidden');
  await f.controller.submit(input());
  assert.equal(f.posts().length, 0);
});
test('sesión malformada exige reintentar comprobación, sin habilitar alta', async () => {
  const f = setup();
  f.state.user = { role: 'COOPERATIVE_ADMIN' };
  await f.controller.checkSession();
  assert.equal(f.last().mode, 'check-error');
});
test('401 de sesión ofrece login; no expone mensaje técnico', async () => {
  const f = setup();
  f.client.request = async () => {
    throw { status: 401, message: 'detalle interno' };
  };
  await f.controller.checkSession();
  assert.equal(f.last().mode, 'signed-out');
  assert.equal(f.last().message.includes('detalle interno'), false);
});
test('caída de consulta de sesión permite comprobar de nuevo sin POST', async () => {
  const f = setup();
  const original = f.client.request;
  f.client.request = async () => {
    throw new Error('offline');
  };
  await f.controller.checkSession();
  assert.equal(f.last().mode, 'check-error');
  f.client.request = original;
  await f.controller.checkSession();
  assert.equal(f.last().mode, 'ready');
  assert.equal(f.posts().length, 0);
});
test('cambio de usuario o cooperativa antes de guardar bloquea alta y conserva identidad anterior', async () => {
  for (const field of ['id', 'cooperative_id']) {
    const f = setup();
    await f.controller.checkSession();
    f.state.user = {
      ...user(),
      [field]: '40000000-0000-4000-8000-000000000001',
    };
    await f.controller.submit(input());
    assert.equal(f.last().mode, 'forbidden');
    assert.equal(f.posts().length, 0);
    await f.controller.checkSession();
    assert.equal(f.last().mode, 'forbidden');
  }
});
test('sesión vencida durante la revalidación impide POST', async () => {
  const f = setup();
  await f.controller.checkSession();
  f.client.request = async () => {
    throw { status: 401 };
  };
  await f.controller.submit(input());
  assert.equal(f.last().mode, 'signed-out');
  assert.equal(f.posts().length, 0);
});
test('dos envíos simultáneos producen un POST y capturan copia de arrays', async () => {
  const f = setup();
  await f.controller.checkSession();
  let finish;
  f.state.post = (data) =>
    new Promise((resolve) => {
      finish = () =>
        resolve({
          frequency: {
            ...data,
            id: '30000000-0000-4000-8000-000000000001',
            cooperative_id: user().cooperative_id,
          },
        });
    });
  const data = input();
  const pending = f.controller.submit(data);
  await nextTurn();
  data.stops.push('Otro');
  await f.controller.submit(input());
  assert.equal(f.posts().length, 1);
  assert.deepEqual(f.posts()[0].options.data.stops, ['Latacunga']);
  finish();
  await pending;
  assert.equal(f.last().mode, 'success');
});
test('duplicado ofrece corrección sin reintento automático', async () => {
  const f = setup();
  await f.controller.checkSession();
  f.state.error = { status: 409, code: 'FREQUENCY_ALREADY_EXISTS' };
  await f.controller.submit(input());
  assert.equal(f.last().mode, 'ready');
  assert.match(f.last().message, /Ya existe/);
  assert.equal(f.posts().length, 1);
});
test('ANT rechazado señala su campo; validación genérica no inventa detalle de campo', async () => {
  const f = setup();
  await f.controller.checkSession();
  for (const code of [
    'FREQUENCY_REQUIRES_ANT_RESOLUTION',
    'VALIDATION_ERROR',
  ]) {
    f.state.error = { status: 400, code };
    await f.controller.submit(input());
    assert.equal(f.last().mode, 'ready');
    assert.equal(
      f.last().errorField,
      code === 'VALIDATION_ERROR' ? undefined : 'ant_resolution_number',
    );
  }
});
test('rechazo CSRF mantiene reenvío manual con cliente compartido, sin repetir POST', async () => {
  const f = setup();
  await f.controller.checkSession();
  f.state.error = { status: 403, code: 'CSRF_TOKEN_INVALID' };
  await f.controller.submit(input());
  assert.equal(f.last().mode, 'ready');
  assert.equal(f.posts().length, 1);
  f.state.error = null;
  await f.controller.submit(input());
  assert.equal(f.last().mode, 'success');
  assert.equal(f.posts().length, 2);
});
test('401 o 403 durante POST detiene acceso', async () => {
  for (const status of [401, 403]) {
    const f = setup();
    await f.controller.checkSession();
    f.state.error = { status, code: 'FORBIDDEN' };
    await f.controller.submit(input());
    assert.equal(f.last().mode, status === 401 ? 'signed-out' : 'forbidden');
    await f.controller.submit(input());
    assert.equal(f.posts().length, 1);
  }
});
test('fallos ambiguos de POST bloquean reenvío incluso al comprobar sesión', async () => {
  for (const error of [
    { code: 'NETWORK_ERROR' },
    { code: 'RESPONSE_INVALID' },
    { status: 500 },
    new Error('desconocido'),
  ]) {
    const f = setup();
    await f.controller.checkSession();
    f.state.error = error;
    await f.controller.submit(input());
    assert.equal(f.last().mode, 'uncertain');
    await f.controller.checkSession();
    assert.equal(f.last().mode, 'uncertain');
    await f.controller.submit(input());
    assert.equal(f.posts().length, 1);
  }
});
test('201 corrupto, tenant distinto o datos diferentes no producen falso éxito', async () => {
  for (const change of [
    { id: 'bad' },
    { cooperative_id: 'otro' },
    { stops: [] },
    { segment_prices: [0, 0] },
    { origin: 'Otra ciudad' },
  ]) {
    const f = setup();
    await f.controller.checkSession();
    f.state.post = async (data) => ({
      frequency: {
        ...data,
        id: '30000000-0000-4000-8000-000000000001',
        cooperative_id: user().cooperative_id,
        ...change,
      },
    });
    await f.controller.submit(input());
    assert.equal(f.last().mode, 'uncertain');
  }
});
test('crear otra frecuencia es explícito y revalida sesión; éxito no se puede reenviar', async () => {
  const f = setup();
  await f.controller.checkSession();
  await f.controller.submit(input());
  await f.controller.submit(input());
  await f.controller.checkSession();
  assert.equal(f.posts().length, 1);
  await f.controller.startAnother();
  assert.equal(f.state.resets, 1);
  assert.equal(f.last().mode, 'ready');
});
