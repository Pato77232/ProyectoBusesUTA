import test from "node:test";
import assert from "node:assert/strict";
import {
  LOGIN_PAGE,
  LOGOUT_PATH,
  bindLogoutButtons,
  createLogoutAction,
} from "../../src/auth/logout.js";

function setup(response) {
  const calls = [];
  const left = [];
  const client = {
    async request(path, options) {
      calls.push([path, options]);
      if (response instanceof Error) throw response;
      return response;
    },
  };
  return { calls, left, client, leave: (path) => left.push(path) };
}

function button() {
  const listeners = [];
  return {
    disabled: false,
    textContent: "Cerrar sesión",
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    addEventListener(type, listener) {
      listeners.push([type, listener]);
    },
    listeners,
  };
}

test("cerrar sesión pide el cierre al backend y vuelve al login", async () => {
  const { calls, left, client, leave } = setup(null);
  assert.equal(await createLogoutAction({ client, leave })(), true);
  assert.deepEqual(calls, [[LOGOUT_PATH, { method: "POST" }]]);
  assert.deepEqual(left, [LOGIN_PAGE]);
});

test("vuelve al login aunque se pierda la respuesta", async () => {
  const { left, client, leave } = setup(new Error("red"));
  await createLogoutAction({ client, leave })();
  assert.deepEqual(left, [LOGIN_PAGE]);
});

test("ignora un segundo clic mientras cierra", async () => {
  let release;
  const calls = [];
  const client = {
    request(path) {
      calls.push(path);
      return new Promise((resolve) => (release = resolve));
    },
  };
  const logout = createLogoutAction({ client, leave() {} });
  const first = logout();
  assert.equal(await logout(), false);
  release();
  assert.equal(await first, true);
  assert.equal(calls.length, 1);
});

test("los botones quedan deshabilitados y anuncian el cierre", async () => {
  const { calls, left, client, leave } = setup(null);
  const buttons = [button(), button()];
  const onClick = bindLogoutButtons({ buttons, client, leave });
  assert.ok(buttons.every(({ listeners }) => listeners[0][0] === "click"));
  await onClick();
  assert.ok(buttons.every((item) => item.disabled));
  assert.ok(buttons.every((item) => item.textContent === "Cerrando sesión…"));
  assert.ok(buttons.every((item) => item.attributes["aria-busy"] === "true"));
  assert.equal(calls.length, 1);
  assert.deepEqual(left, [LOGIN_PAGE]);
});

test("no hace nada si la página no tiene botón de cierre", () => {
  const { calls, client, leave } = setup(null);
  assert.equal(bindLogoutButtons({ buttons: [], client, leave }), null);
  assert.equal(calls.length, 0);
});
