import test from "node:test";
import assert from "node:assert/strict";
import { createLoginController } from "../../src/auth/login-controller.js";

const admin = { email: "admin@qa.invalid", role: "SYSTEM_ADMIN" };
const customer = { email: "customer@qa.invalid", role: "CUSTOMER" };
const absent = () => {
  throw { status: 401 };
};
function setup(request) {
  const states = [],
    calls = [],
    authenticated = [];
  let cleared = 0;
  const controller = createLoginController({
    client: {
      request: (...args) => {
        calls.push(args);
        return request(...args);
      },
    },
    view: {
      render: (state) => states.push(state),
      clearCredentials: () => {
        cleared++;
      },
      clearPassword() {},
    },
    onAuthenticated: (user) => authenticated.push(user),
  });
  return {
    ...controller,
    states,
    calls,
    authenticated,
    get cleared() {
      return cleared;
    },
  };
}

test("cierra sesión confirmada y permite autenticar una identidad distinta", async () => {
  let user = admin;
  const c = setup((path, options) => {
    if (path.endsWith("/logout")) {
      user = null;
      return null;
    }
    if (path.endsWith("/login")) {
      assert.equal(options.data.email, customer.email);
      user = customer;
      return null;
    }
    return user ? { user } : absent();
  });
  await c.checkSession();
  await c.changeAccount();
  assert.equal(c.states.at(-1).mode, "form");
  assert.match(c.states.at(-1).message, /Sesión cerrada/);
  assert.equal(c.cleared, 1);
  assert.deepEqual(c.calls[1], ["/api/v1/auth/logout", { method: "POST" }]);
  await c.submit({
    email: customer.email,
    password: "contraseña ficticia larga",
  });
  assert.equal(c.states.at(-1).email, customer.email);
  assert.deepEqual(c.authenticated, [admin, customer]);
});

test("doble clic, login y comprobación durante cierre no duplican solicitudes", async () => {
  let finish,
    user = admin;
  const c = setup((path) => {
    if (path.endsWith("/logout"))
      return new Promise((resolve) => {
        finish = () => {
          user = null;
          resolve(null);
        };
      });
    return user ? { user } : absent();
  });
  await c.checkSession();
  const pending = c.changeAccount();
  await c.changeAccount();
  await c.checkSession();
  await c.submit({
    email: customer.email,
    password: "contraseña ficticia larga",
  });
  assert.equal(c.states.at(-1).mode, "signing-out");
  assert.equal(c.calls.length, 2);
  finish();
  await pending;
  assert.equal(c.states.at(-1).mode, "form");
});

for (const error of [
  { code: "CSRF_TOKEN_INVALID", status: 403 },
  { code: "NETWORK_ERROR" },
]) {
  test(`cierre rechazado ${error.code} conserva sesión verificada sin redirigir`, async () => {
    const c = setup((path) => {
      if (path.endsWith("/logout")) throw error;
      return { user: admin };
    });
    await c.checkSession();
    await c.changeAccount();
    await c.checkSession();
    assert.equal(c.states.at(-1).mode, "session");
    assert.match(c.states.at(-1).message, /sigue activa/);
    assert.equal(c.authenticated.length, 1);
    assert.equal(
      c.calls.filter(([path]) => path.endsWith("/logout")).length,
      1,
    );
    await c.submit({
      email: customer.email,
      password: "contraseña ficticia larga",
    });
    assert.equal(c.calls.filter(([path]) => path.endsWith("/login")).length, 0);
  });
}

test("respuesta perdida tras revocar permite formulario solo al comprobar 401", async () => {
  let active = true;
  const c = setup((path) => {
    if (path.endsWith("/logout")) {
      active = false;
      throw { code: "NETWORK_ERROR" };
    }
    return active ? { user: admin } : absent();
  });
  await c.checkSession();
  await c.changeAccount();
  assert.equal(c.states.at(-1).mode, "form");
  assert.equal(c.calls.filter(([path]) => path.endsWith("/logout")).length, 1);
});

for (const response of [
  () => {
    throw { code: "NETWORK_ERROR" };
  },
  () => ({ user: {} }),
]) {
  test("comprobación fallida tras cierre queda incierta y se recupera sin repetir POST", async () => {
    let reads = 0;
    const c = setup((path) => {
      if (path.endsWith("/logout")) return null;
      reads++;
      if (reads === 1) return { user: admin };
      if (reads === 2) return response();
      return absent();
    });
    await c.checkSession();
    await c.changeAccount();
    assert.equal(c.states.at(-1).mode, "uncertain");
    await c.changeAccount();
    await c.submit({
      email: customer.email,
      password: "contraseña ficticia larga",
    });
    await c.checkSession();
    assert.equal(c.states.at(-1).mode, "form");
    assert.equal(
      c.calls.filter(([path]) => path.endsWith("/logout")).length,
      1,
    );
  });
}

test("401 al cerrar una sesión ya vencida permite ingresar otra cuenta", async () => {
  let reads = 0;
  const c = setup((path) => {
    if (path.endsWith("/logout")) return absent();
    return reads++ === 0 ? { user: admin } : absent();
  });
  await c.checkSession();
  await c.changeAccount();
  assert.equal(c.states.at(-1).mode, "form");
});

test("no envía logout sin sesión previamente confirmada", async () => {
  const c = setup(absent);
  await c.changeAccount();
  await c.checkSession();
  await c.changeAccount();
  assert.deepEqual(
    c.calls.map(([path]) => path),
    ["/api/v1/auth/me"],
  );
});
