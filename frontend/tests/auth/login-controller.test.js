import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLoginController } from '../../src/auth/login-controller.js';

const credentials = { email: 'cliente@qa.invalid', password: 'contraseña-solo-QA' };
const reject = (error) => {
  throw error;
};
function setup(request, onAuthenticated = () => {}) {
  const states = [];
  const calls = [];
  let cleared = 0;
  const controller = createLoginController({
    onAuthenticated,
    client: {
      request: (...args) => {
        calls.push(args);
        return request(...args);
      },
    },
    view: {
      render: (state) => states.push(state),
      clearPassword: () => {
        cleared += 1;
      },
    },
  });
  return {
    ...controller,
    states,
    calls,
    get cleared() {
      return cleared;
    },
  };
}
const absent = () => reject({ status: 401 });

test('retorno posterior se ejecuta solo tras confirmar auth/me', async () => {
  let logged = false;
  let returned = 0;
  const c = setup((path) => {
    if (path.endsWith('/login')) { logged = true; return null; }
    return logged ? { user: { email: credentials.email } } : absent();
  }, () => { returned += 1; });
  await c.checkSession();
  assert.equal(returned, 0);
  await c.submit(credentials);
  assert.equal(returned, 1);
});

test('401 inicial permite formulario y una sesión existente evita otro login', async () => {
  const form = setup(absent);
  await form.checkSession();
  assert.equal(form.states.at(-1).mode, 'form');
  const session = setup(() => ({ user: { email: credentials.email } }));
  await session.checkSession();
  await session.submit(credentials);
  assert.equal(session.states.at(-1).mode, 'session');
  assert.equal(session.calls.length, 1);
});

test('fallo inicial o respuesta mal formada no afirman ausencia de sesión', async () => {
  for (const request of [() => reject({ code: 'NETWORK_ERROR' }), () => ({ user: {} })]) {
    const c = setup(request);
    await c.checkSession();
    await c.submit(credentials);
    assert.equal(c.states.at(-1).mode, 'uncertain');
    assert.equal(c.calls.length, 1);
  }
});

test('valida correo y longitud Unicode sin enviar datos inválidos', async () => {
  for (const data of [
    { ...credentials, email: 'invalido' },
    { ...credentials, email: 'a'.repeat(250) + '@qa.invalid' },
    { ...credentials, password: '😀'.repeat(14) },
    { ...credentials, password: '😀'.repeat(129) },
  ]) {
    const c = setup(absent);
    await c.checkSession();
    await c.submit(data);
    assert.equal(c.calls.length, 1);
    assert.ok(c.states.at(-1).errorField);
    assert.equal(c.cleared, 1);
  }
});

test('conserva contraseña Unicode/espacios y confirma identidad tras POST', async () => {
  let logged = false;
  const c = setup((path) => {
    if (path.endsWith('/login')) {
      logged = true;
      return null;
    }
    return logged ? { user: { email: credentials.email } } : absent();
  });
  await c.checkSession();
  const password = ' ' + '😀'.repeat(126) + ' ';
  await c.submit({ ...credentials, password });
  assert.deepEqual(
    c.calls.map(([path]) => path),
    ['/api/v1/auth/me', '/api/v1/auth/login', '/api/v1/auth/me'],
  );
  assert.equal(c.calls[1][1].data.password, password);
  assert.equal(c.states.at(-1).email, credentials.email);
  assert.equal(c.cleared, 1);
});

test('doble envío o comprobación durante POST no duplican operaciones', async () => {
  let finish;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  const c = setup((path) => (path.endsWith('/login') ? pending : absent()));
  await c.checkSession();
  const first = c.submit(credentials);
  await c.submit(credentials);
  await c.checkSession();
  assert.equal(c.calls.length, 2);
  finish(null);
  await first;
  assert.equal(c.states.at(-1).mode, 'uncertain');
});

for (const code of [
  'VALIDATION_ERROR',
  'INVALID_CREDENTIALS',
  'CSRF_TOKEN_INVALID',
  'TOO_MANY_ATTEMPTS',
]) {
  test(`${code} permite intento explícito y oculta detalles externos`, async () => {
    const c = setup((path) =>
      path.endsWith('/login') ? reject({ code, message: '<secreto>' }) : absent(),
    );
    await c.checkSession();
    await c.submit(credentials);
    assert.equal(c.states.at(-1).mode, 'form');
    assert.ok(!c.states.at(-1).message.includes('<secreto>'));
    assert.equal(c.calls.filter(([path]) => path.endsWith('/login')).length, 1);
    assert.equal(c.cleared, 1);
  });
}

for (const code of ['NETWORK_ERROR', 'REQUEST_ABORTED', 'SERVER_ERROR', 'RESPONSE_INVALID']) {
  test(`${code} no reintenta y exige comprobar sesión`, async () => {
    let logged = false;
    const c = setup((path) => {
      if (path.endsWith('/login')) {
        logged = true;
        return reject({ code });
      }
      return logged ? { user: { email: credentials.email } } : absent();
    });
    await c.checkSession();
    await c.submit(credentials);
    await c.submit(credentials);
    assert.equal(c.states.at(-1).mode, 'uncertain');
    await c.checkSession();
    assert.equal(c.states.at(-1).mode, 'session');
    assert.equal(c.calls.filter(([path]) => path.endsWith('/login')).length, 1);
  });
}

test('POST exitoso seguido de fallo en me permite recuperación sin repetir POST', async () => {
  let reads = 0;
  const c = setup((path) => {
    if (path.endsWith('/login')) return null;
    reads += 1;
    return reads < 3 ? absent() : { user: { email: credentials.email } };
  });
  await c.checkSession();
  await c.submit(credentials);
  assert.equal(c.states.at(-1).mode, 'uncertain');
  await c.checkSession();
  assert.equal(c.states.at(-1).mode, 'session');
});
