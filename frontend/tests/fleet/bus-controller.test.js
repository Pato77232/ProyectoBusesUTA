import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBusController } from '../../src/fleet/bus-controller.js';

const ADMIN = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'COOPERATIVE_ADMIN',
  cooperative_id: '22222222-2222-4222-8222-222222222222',
};
const GROUPS = [{ id: '33333333-3333-4333-8333-333333333333', name: 'Rutas largas' }];
const LAYOUTS = [{ id: 'SINGLE_DECK_2_2', name: 'Un piso', capacity: 42, version: 1, decks: [] }];
const BUS = {
  id: '44444444-4444-4444-8444-444444444444',
  plate: 'TBM-2213',
  unitNumber: 7,
  capacity: 41,
};
const DATA = { plate: 'TBM-2213', unitNumber: 7, disabledSeatKeys: ['deck-1-0-0'] };
const PHOTOS = [new globalThis.File([new Uint8Array(10)], 'bus.png', { type: 'image/png' })];

const failure = (status, code) => Object.assign(new Error(code), { status, code });

function fixture(routes = {}) {
  const calls = [];
  const events = [];
  const replies = {
    'GET /api/v1/auth/me': () => ({ user: ADMIN }),
    'GET /api/v1/bus-groups': () => ({ busGroups: GROUPS }),
    'GET /api/v1/seat-layouts': () => ({ seatLayouts: LAYOUTS }),
    'POST /api/v1/buses': () => ({ bus: BUS }),
    ...routes,
  };
  const client = {
    async request(path, options = {}) {
      const key = `${options.method ?? 'GET'} ${path}`;
      calls.push({ key, ...options });
      return replies[key]();
    },
  };
  const record =
    (name) =>
    (...args) =>
      events.push([name, ...args]);
  const view = {
    mount: record('mount'),
    status: record('status'),
    busy: record('busy'),
    replaceGroups: record('replaceGroups'),
    registered: record('registered'),
    signedOut: record('signedOut'),
    blocked: record('blocked'),
  };
  return { controller: createBusController({ client, view }), calls, events };
}

const last = (events, name) => events.filter(([event]) => event === name).at(-1);

test('con sesión de administrador monta grupos y plantillas reales', async () => {
  const { controller, events } = fixture();
  await controller.start();
  const [, options] = last(events, 'mount');
  assert.deepEqual(options.busGroups, GROUPS);
  assert.deepEqual(options.seatLayouts, LAYOUTS);
});

for (const [role, cooperativeId] of [
  ['CLERK', ADMIN.cooperative_id],
  ['CUSTOMER', null],
  ['COOPERATIVE_ADMIN', 'no-uuid'],
]) {
  test(`una sesión ${role} no carga datos ni monta el formulario`, async () => {
    const { controller, calls, events } = fixture({
      'GET /api/v1/auth/me': () => ({ user: { ...ADMIN, role, cooperative_id: cooperativeId } }),
    });
    await controller.start();
    assert.deepEqual(
      calls.map((call) => call.key),
      ['GET /api/v1/auth/me'],
    );
    assert.equal(last(events, 'mount'), undefined);
    assert.match(last(events, 'blocked')[1], /administrador de cooperativa/);
  });
}

test('sin sesión indica que inicie sesión', async () => {
  const { controller, events } = fixture({
    'GET /api/v1/auth/me': () => {
      throw failure(401, 'UNAUTHENTICATED');
    },
  });
  await controller.start();
  assert.match(last(events, 'signedOut')[1], /Inicia sesión/);
});

test('envía multipart con data y fotos, sin cooperativa, y confirma con el servidor', async () => {
  const { controller, calls, events } = fixture();
  await controller.submit(DATA, PHOTOS);
  const post = calls.find((call) => call.key === 'POST /api/v1/buses');
  assert.deepEqual(JSON.parse(post.formData.get('data')), DATA);
  assert.equal(post.formData.getAll('photos').length, 1);
  assert.equal(post.formData.get('data').includes('cooperative'), false);
  assert.equal(post.data, undefined);
  assert.deepEqual(last(events, 'registered'), ['registered', BUS]);
  assert.deepEqual(
    events.filter(([event]) => event === 'busy').map(([, active]) => active),
    [true, false],
  );
});

test('revalida la sesión antes de enviar', async () => {
  const { controller, calls } = fixture();
  await controller.submit(DATA, PHOTOS);
  assert.deepEqual(
    calls.map((call) => call.key),
    ['GET /api/v1/auth/me', 'POST /api/v1/buses'],
  );
});

test('un doble envío mientras el primero sigue en curso solo registra un bus', async () => {
  let release;
  const { controller, calls } = fixture({
    'POST /api/v1/buses': () => new Promise((resolve) => (release = () => resolve({ bus: BUS }))),
  });
  const first = controller.submit(DATA, PHOTOS);
  await controller.submit(DATA, PHOTOS);
  while (!release) await null;
  release();
  await first;
  assert.equal(calls.filter((call) => call.key === 'POST /api/v1/buses').length, 1);
});

for (const [status, code, message] of [
  [409, 'BUS_ALREADY_EXISTS', /ya están registrados/],
  [400, 'VALIDATION_ERROR', /Revisa los datos/],
  [413, 'PAYLOAD_TOO_LARGE', /tamaño permitido/],
  [403, 'CSRF_TOKEN_INVALID', /volver a enviarla/],
]) {
  test(`${status} ${code} conserva el formulario y explica el rechazo`, async () => {
    const { controller, events } = fixture({
      'POST /api/v1/buses': () => {
        throw failure(status, code);
      },
    });
    await controller.submit(DATA, PHOTOS);
    assert.match(last(events, 'status')[1], message);
    assert.equal(last(events, 'status')[2], 'error');
    assert.equal(last(events, 'registered'), undefined);
    assert.deepEqual(last(events, 'busy'), ['busy', false]);
  });
}

for (const [status, code] of [
  [504, 'SERVER_ERROR'],
  [502, 'SERVER_ERROR'],
  [0, 'NETWORK_ERROR'],
]) {
  test(`${code} ${status} avisa que el resultado es incierto y no reintenta`, async () => {
    const { controller, calls, events } = fixture({
      'POST /api/v1/buses': () => {
        throw failure(status, code);
      },
    });
    await controller.submit(DATA, PHOTOS);
    assert.match(last(events, 'status')[1], /No pudimos confirmar si el bus se registró/);
    assert.equal(calls.filter((call) => call.key === 'POST /api/v1/buses').length, 1);
  });
}

test('404 de grupo recarga la lista de grupos y lo indica', async () => {
  const { controller, events } = fixture({
    'POST /api/v1/buses': () => {
      throw failure(404, 'BUS_GROUP_NOT_FOUND');
    },
  });
  await controller.submit(DATA, PHOTOS);
  assert.deepEqual(last(events, 'replaceGroups'), ['replaceGroups', GROUPS]);
  assert.match(last(events, 'status')[1], /grupo elegido ya no está disponible/);
});

for (const [name, reply] of [
  ['sin los datos esperados', () => ({ bus: { plate: 'X' } })],
  ['sin cuerpo', () => null],
  [
    'no válida',
    () => {
      throw failure(201, 'RESPONSE_INVALID');
    },
  ],
]) {
  test(`una respuesta exitosa ${name} indica resultado incierto y no reintenta`, async () => {
    const { controller, calls, events } = fixture({ 'POST /api/v1/buses': reply });
    await controller.submit(DATA, PHOTOS);
    assert.equal(last(events, 'registered'), undefined);
    assert.match(last(events, 'status')[1], /No pudimos confirmar si el bus se registró/);
    assert.doesNotMatch(last(events, 'status')[1], /No se aceptó/);
    assert.equal(calls.filter((call) => call.key === 'POST /api/v1/buses').length, 1);
    assert.deepEqual(last(events, 'busy'), ['busy', false]);
  });
}

test('si la sesión cambia de cooperativa antes de enviar, no envía', async () => {
  let user = ADMIN;
  const { controller, calls, events } = fixture({ 'GET /api/v1/auth/me': () => ({ user }) });
  await controller.start();
  user = { ...ADMIN, cooperative_id: '55555555-5555-4555-8555-555555555555' };
  await controller.submit(DATA, PHOTOS);
  assert.equal(calls.filter((call) => call.key === 'POST /api/v1/buses').length, 0);
  assert.match(last(events, 'blocked')[1], /La sesión cambió/);
});
