import test from "node:test";
import assert from "node:assert/strict";
import { createAccountController } from "../../src/admin/account-controller.js";
import { createCooperativesController } from "../../src/admin/cooperatives-controller.js";
import {
  fetchCooperatives,
  validateAccount,
} from "../../src/admin/admin-core.js";

const cooperativeId = "00000000-0000-4000-8000-000000000001";
const otherId = "00000000-0000-4000-8000-000000000002";
const cooperative = {
  id: cooperativeId,
  name: "Cooperativa UTA",
  ruc: "0012345678901",
};
const password = "contraseña segura de prueba";
const credentials = {
  email: "nuevo@example.ec",
  password,
  confirmation: password,
};

function view() {
  const calls = [];
  const result = { calls };
  for (const method of [
    "setBusy",
    "showAccess",
    "showCooperatives",
    "notice",
    "deny",
    "invalid",
    "clearSecrets",
    "lockUncertain",
    "showResult",
    "showCreated",
    "clearResult",
  ]) {
    result[method] = (...args) => calls.push([method, ...args]);
  }
  return result;
}

test("catálogo rechaza respuesta corrupta, duplicados y datos mal formados", async () => {
  for (const cooperatives of [
    null,
    [{ ...cooperative, id: "bad" }],
    [cooperative, cooperative],
    [{ ...cooperative, ruc: "123" }],
  ]) {
    await assert.rejects(
      fetchCooperatives({ request: async () => ({ cooperatives }) }),
    );
  }
});

test("SYSTEM_ADMIN selecciona cooperativa existente y envía solo credenciales al crear administrador", async () => {
  const calls = [];
  const client = {
    request: async (path, options) => {
      calls.push([path, options]);
      if (path.endsWith("/me"))
        return { user: { email: "global@example.ec", role: "SYSTEM_ADMIN" } };
      if (path === "/api/v1/cooperatives" && !options)
        return { cooperatives: [cooperative] };
      return {
        user: {
          email: credentials.email,
          role: "COOPERATIVE_ADMIN",
          cooperative_id: cooperativeId,
        },
      };
    },
  };
  const rendered = view();
  const controller = createAccountController({
    client,
    view: rendered,
    kind: "administrator",
    requestedCooperativeId: cooperativeId,
  });
  await controller.start();
  assert.deepEqual(
    rendered.calls.find(([method]) => method === "showCooperatives").slice(1),
    [[cooperative], cooperativeId],
  );
  await controller.submit({ cooperativeId, ...credentials });
  assert.deepEqual(calls.at(-1), [
    `/api/v1/cooperatives/${cooperativeId}/admins`,
    { method: "POST", data: { email: credentials.email, password } },
  ]);
  assert(rendered.calls.some(([method]) => method === "showResult"));
  assert(rendered.calls.some(([method]) => method === "clearSecrets"));
});

test("administrador no usa un ID manipulado que no conste en el catálogo", async () => {
  const calls = [];
  const client = {
    request: async (path) => {
      calls.push(path);
      return path.endsWith("/me")
        ? { user: { email: "global@example.ec", role: "SYSTEM_ADMIN" } }
        : { cooperatives: [cooperative] };
    },
  };
  const rendered = view();
  const controller = createAccountController({
    client,
    view: rendered,
    kind: "administrator",
    requestedCooperativeId: otherId,
  });
  await controller.start();
  await controller.submit({ cooperativeId: otherId, ...credentials });
  assert.equal(calls.length, 2);
  assert(
    rendered.calls.some(
      ([method, field]) => method === "invalid" && field === "cooperative",
    ),
  );
});

test("oficinista se crea con cooperativa de sesión, sin tenant elegido en cuerpo", async () => {
  const calls = [];
  const client = {
    request: async (path, options) => {
      calls.push([path, options]);
      if (path.endsWith("/me"))
        return {
          user: {
            email: "operador@example.ec",
            role: "COOPERATIVE_ADMIN",
            cooperative_id: cooperativeId,
          },
        };
      return {
        user: {
          email: credentials.email,
          role: "CLERK",
          cooperative_id: cooperativeId,
        },
      };
    },
  };
  const rendered = view();
  const controller = createAccountController({
    client,
    view: rendered,
    kind: "clerks",
  });
  await controller.start();
  await controller.submit({ cooperativeId: otherId, ...credentials });
  assert.deepEqual(calls.at(-1), [
    "/api/v1/auth/clerks",
    { method: "POST", data: { email: credentials.email, password } },
  ]);
  assert(rendered.calls.some(([method]) => method === "showResult"));
});

test("rol ajeno no habilita altas y error de red incierto bloquea reenvío", async () => {
  const deniedCalls = [];
  const denied = createAccountController({
    client: {
      request: async (path) => {
        deniedCalls.push(path);
        return { user: { email: "cliente@example.ec", role: "CUSTOMER" } };
      },
    },
    view: view(),
    kind: "administrator",
  });
  await denied.start();
  await denied.submit({ cooperativeId, ...credentials });
  assert.deepEqual(deniedCalls, ["/api/v1/auth/me"]);

  const calls = [];
  const rendered = view();
  const uncertain = createAccountController({
    client: {
      request: async (path) => {
        calls.push(path);
        if (path.endsWith("/me"))
          return {
            user: {
              email: "operador@example.ec",
              role: "COOPERATIVE_ADMIN",
              cooperative_id: cooperativeId,
            },
          };
        throw new Error("network");
      },
    },
    view: rendered,
    kind: "clerks",
  });
  await uncertain.start();
  await uncertain.submit(credentials);
  await uncertain.submit(credentials);
  assert.equal(calls.filter((path) => path.endsWith("/clerks")).length, 1);
  assert(rendered.calls.some(([method]) => method === "lockUncertain"));
});

test("409 de administrador permite corregir el alta sin duplicar el envío", async () => {
  let attempts = 0;
  const rendered = view();
  const client = {
    request: async (path, options) => {
      if (path.endsWith("/me"))
        return { user: { email: "global@example.ec", role: "SYSTEM_ADMIN" } };
      if (!options) return { cooperatives: [cooperative] };
      attempts += 1;
      if (attempts === 1) throw { status: 409, code: "REGISTRATION_CONFLICT" };
      return {
        user: {
          email: credentials.email,
          role: "COOPERATIVE_ADMIN",
          cooperative_id: cooperativeId,
        },
      };
    },
  };
  const controller = createAccountController({
    client,
    view: rendered,
    kind: "administrator",
  });
  await controller.start();
  await controller.submit({ cooperativeId, ...credentials });
  assert(
    rendered.calls.some(
      ([method, message]) =>
        method === "notice" && message.includes("ocupados"),
    ),
  );
  await controller.submit({ cooperativeId, ...credentials });
  assert.equal(attempts, 2);
  assert.equal(
    rendered.calls.filter(([method]) => method === "showResult").length,
    1,
  );
  assert.equal(
    rendered.calls.filter(([method]) => method === "lockUncertain").length,
    0,
  );
});

test("cooperativa usa catálogo protegido y no repite alta con resultado incierto", async () => {
  const calls = [];
  let fail = false;
  const client = {
    request: async (path, options) => {
      calls.push([path, options]);
      if (path.endsWith("/me"))
        return { user: { email: "global@example.ec", role: "SYSTEM_ADMIN" } };
      if (options?.method === "POST") {
        if (fail) throw new Error("network");
        return { cooperative: { ...cooperative } };
      }
      return { cooperatives: [cooperative] };
    },
  };
  const rendered = view();
  const controller = createCooperativesController({ client, view: rendered });
  await controller.start();
  await controller.submit({
    name: cooperative.name,
    ruc: cooperative.ruc,
    email: "",
    phone: "",
    address: "",
  });
  assert(rendered.calls.some(([method]) => method === "showCreated"));
  assert.deepEqual(
    calls.find(([, options]) => options?.method === "POST")[1].data,
    {
      name: cooperative.name,
      ruc: cooperative.ruc,
      email: null,
      phone: null,
      address: null,
    },
  );
  fail = true;
  await controller.submit({
    name: cooperative.name,
    ruc: cooperative.ruc,
    email: "",
    phone: "",
    address: "",
  });
  await controller.submit({
    name: cooperative.name,
    ruc: cooperative.ruc,
    email: "",
    phone: "",
    address: "",
  });
  assert.equal(
    calls.filter(([, options]) => options?.method === "POST").length,
    2,
  );
  assert(rendered.calls.some(([method]) => method === "lockUncertain"));
});

test("validación de cuenta comprueba correo, longitud y confirmación", () => {
  assert.equal(
    validateAccount({ ...credentials, email: "bad" }).field,
    "email",
  );
  assert.equal(
    validateAccount({ ...credentials, password: "short" }).field,
    "password",
  );
  assert.equal(
    validateAccount({ ...credentials, confirmation: "otra" }).field,
    "confirmation",
  );
  assert.equal(validateAccount(credentials), null);
});
