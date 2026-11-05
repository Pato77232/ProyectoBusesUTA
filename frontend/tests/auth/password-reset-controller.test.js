import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPasswordResetController,
  takeResetToken,
} from "../../src/auth/password-reset-controller.js";

const token = "a".repeat(43);
function setup({ response = async () => null, resetToken = token } = {}) {
  const calls = [];
  const states = [];
  let cleared = 0;
  const controller = createPasswordResetController({
    client: {
      request: (...args) => {
        calls.push(args);
        return response(...args);
      },
    },
    view: {
      render: (state) => states.push(state),
      clearPasswords: () => {
        cleared += 1;
      },
    },
    token: resetToken,
  });
  return {
    ...controller,
    calls,
    states,
    get cleared() {
      return cleared;
    },
  };
}

test("lee el fragmento y lo borra antes de iniciar solicitudes", () => {
  const changes = [];
  const value = takeResetToken(
    { hash: `#token=${token}`, pathname: "/pages/restablecer.html" },
    { replaceState: (...args) => changes.push(args) },
  );
  assert.equal(value, token);
  assert.deepEqual(changes, [[null, "", "/pages/restablecer.html"]]);
  assert.equal(
    takeResetToken(
      {
        hash: `#token=${token}&token=${token}`,
        pathname: "/pages/restablecer.html",
      },
      { replaceState() {} },
    ),
    null,
  );
});

test("solicitud valida correo y muestra la misma respuesta pública", async () => {
  const c = setup();
  await c.request("no-es-correo");
  assert.equal(c.calls.length, 0);
  assert.equal(c.states.at(-1).errorField, "email");
  await c.request(" CLIENTE@EXAMPLE.EC ");
  assert.deepEqual(c.calls[0], [
    "/api/v1/auth/password-reset",
    { method: "POST", data: { email: "cliente@example.ec" } },
  ]);
  assert.equal(c.states.at(-1).mode, "complete");
  assert.match(c.states.at(-1).message, /Si la cuenta existe/);
});

test("solicitud informa el límite por IP y no revela detalles del servidor", async () => {
  const c = setup({
    response: async () => {
      throw { code: "TOO_MANY_ATTEMPTS", message: "secreto" };
    },
  });
  await c.request("cliente@example.ec");
  assert.equal(c.states.at(-1).mode, "ready");
  assert.doesNotMatch(c.states.at(-1).message, /secreto/);
});

test("confirmación valida política y coincidencia antes de enviar", async () => {
  const c = setup();
  c.ready();
  await c.confirm("corta", "corta");
  await c.confirm("contraseña suficientemente larga", "diferente");
  assert.equal(c.calls.length, 0);
  assert.equal(c.states.at(-1).errorField, "confirmPassword");
});

test("confirmación exitosa consume el token, limpia campos y lleva al login", async () => {
  const c = setup();
  const password = "contraseña suficientemente larga";
  await c.confirm(password, password);
  assert.deepEqual(c.calls[0], [
    "/api/v1/auth/password-reset/confirm",
    { method: "POST", data: { token, password } },
  ]);
  assert.equal(c.cleared, 1);
  assert.equal(c.states.at(-1).mode, "complete");
  await c.confirm(password, password);
  assert.equal(c.calls.length, 1);
});

test("token ausente o rechazado muestra salida segura y evita otro POST", async () => {
  const missing = setup({ resetToken: null });
  missing.ready();
  await missing.confirm(
    "contraseña suficientemente larga",
    "contraseña suficientemente larga",
  );
  assert.equal(missing.states.at(-1).mode, "invalid");
  assert.equal(missing.calls.length, 0);
  const rejected = setup({
    response: async () => {
      throw { code: "INVALID_RESET_TOKEN" };
    },
  });
  await rejected.confirm(
    "contraseña suficientemente larga",
    "contraseña suficientemente larga",
  );
  assert.equal(rejected.states.at(-1).mode, "invalid");
  assert.equal(rejected.cleared, 1);
});

test("doble envío no duplica confirmación", async () => {
  let finish;
  const response = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const c = setup({ response });
  const password = "contraseña suficientemente larga";
  const first = c.confirm(password, password);
  await c.confirm(password, password);
  assert.equal(c.calls.length, 1);
  finish();
  await first;
});
