import { test } from "node:test";
import assert from "node:assert/strict";
import { createRegisterController } from "../../src/auth/register-controller.js";

const credentials = {
  email: "cliente@qa.invalid",
  password: "contraseña-solo-QA",
  confirmation: "contraseña-solo-QA",
};

function setup(request) {
  const states = [];
  const calls = [];
  let cleared = 0;
  const registered = [];
  const controller = createRegisterController({
    onRegistered: (email) => registered.push(email),
    client: {
      request: (...args) => {
        calls.push(args);
        return request(...args);
      },
    },
    view: {
      render: (value) => states.push(value),
      clearPassword: () => {
        cleared += 1;
      },
    },
  });
  return {
    ...controller,
    states,
    calls,
    registered,
    get cleared() {
      return cleared;
    },
  };
}

test("201 envía solo credenciales y ofrece iniciar sesión sin crear sesión", async () => {
  const c = setup(() => null);
  const password = " " + "😀".repeat(126) + " ";
  await c.submit({
    email: credentials.email,
    password,
    confirmation: password,
    role: "SYSTEM_ADMIN",
  });
  assert.deepEqual(c.calls, [
    [
      "/api/v1/auth/register",
      { method: "POST", data: { email: credentials.email, password } },
    ],
  ]);
  assert.equal(c.states.at(-1).mode, "success");
  assert.deepEqual(c.registered, [credentials.email]);
  assert.equal(c.cleared, 1);
  await c.submit(credentials);
  assert.equal(c.calls.length, 1);
});

test("valida email y longitud Unicode antes de enviar", async () => {
  for (const data of [
    { ...credentials, email: "invalido" },
    {
      ...credentials,
      password: "😀".repeat(14),
      confirmation: "😀".repeat(14),
    },
    {
      ...credentials,
      password: "😀".repeat(129),
      confirmation: "😀".repeat(129),
    },
    { ...credentials, confirmation: "otra-contraseña" },
  ]) {
    const c = setup(() => null);
    await c.submit(data);
    assert.equal(c.calls.length, 0);
    assert.ok(c.states.at(-1).errorField);
    assert.equal(c.cleared, 1);
  }
});

test("un envío pendiente bloquea el segundo", async () => {
  let finish;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  const c = setup(() => pending);
  const first = c.submit(credentials);
  await c.submit(credentials);
  assert.equal(c.calls.length, 1);
  finish(null);
  await first;
});

for (const code of [
  "VALIDATION_ERROR",
  "CSRF_TOKEN_INVALID",
  "REGISTRATION_CONFLICT",
]) {
  test(`${code} permite un intento explícito y no expone respuesta del servidor`, async () => {
    const c = setup(() => {
      throw { code, message: "detalle sensible" };
    });
    await c.submit(credentials);
    assert.equal(c.states.at(-1).mode, "form");
    assert.ok(!c.states.at(-1).message.includes("detalle sensible"));
    assert.equal(c.cleared, 1);
  });
}

for (const code of ["NETWORK_ERROR", "RESPONSE_INVALID", "SERVER_ERROR"]) {
  test(`${code} conserva resultado incierto sin reenviar`, async () => {
    const c = setup(() => {
      throw { code };
    });
    await c.submit(credentials);
    await c.submit(credentials);
    assert.equal(c.states.at(-1).mode, "uncertain");
    assert.equal(c.calls.length, 1);
    assert.equal(c.cleared, 1);
  });
}
