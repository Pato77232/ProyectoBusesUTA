import assert from "node:assert/strict";
import { test } from "node:test";
import {
  categoryLabel,
  createBusGroupController,
} from "../../src/fleet/bus-group-controller.js";

const ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  role: "COOPERATIVE_ADMIN",
  cooperative_id: "22222222-2222-4222-8222-222222222222",
};
const GROUP = {
  id: "44444444-4444-4444-8444-444444444444",
  name: "Rutas largas",
  category: "LONG_ROUTE",
};

function apiError(status, code) {
  return Object.assign(new Error(code), { status, code });
}

function setup(responses) {
  const calls = [];
  const events = [];
  const client = {
    async request(path, options = {}) {
      calls.push([path, options]);
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return typeof next === "function" ? next(path, options) : next;
    },
  };
  const view = new Proxy(
    {},
    {
      get:
        (_, name) =>
        (...args) =>
          events.push([name, ...args]),
    },
  );
  return {
    calls,
    events,
    controller: createBusGroupController({ client, view }),
  };
}
const named = (events, name) => events.filter(([event]) => event === name);

test("carga los grupos de la cooperativa tras verificar la sesión", async () => {
  const { controller, calls, events } = setup([
    { user: ADMIN },
    { busGroups: [GROUP] },
  ]);
  await controller.start();
  assert.deepEqual(
    calls.map(([path]) => path),
    ["/api/v1/auth/me", "/api/v1/bus-groups"],
  );
  assert.deepEqual(named(events, "groups"), [["groups", [GROUP]]]);
  assert.equal(named(events, "ready").length, 1);
});

test("muestra la lista vacía sin tratarla como error", async () => {
  const { controller, events } = setup([{ user: ADMIN }, { busGroups: [] }]);
  await controller.start();
  assert.deepEqual(named(events, "groups"), [["groups", []]]);
  assert.equal(named(events, "failed").length, 0);
});

test("bloquea otros roles sin consultar los grupos", async () => {
  const { controller, calls, events } = setup([
    { user: { ...ADMIN, role: "CUSTOMER" } },
  ]);
  await controller.start();
  assert.equal(calls.length, 1);
  assert.match(named(events, "blocked")[0][1], /administrador de cooperativa/);
});

test("ofrece iniciar sesión cuando la sesión venció", async () => {
  const { controller, events } = setup([apiError(401, "UNAUTHENTICATED")]);
  await controller.start();
  assert.equal(named(events, "signedOut").length, 1);
});

test("rechaza una lista con datos inesperados", async () => {
  const { controller, events } = setup([
    { user: ADMIN },
    { busGroups: [{ ...GROUP, category: "OTRA" }] },
  ]);
  await controller.start();
  assert.equal(named(events, "failed").length, 1);
  assert.equal(named(events, "ready").length, 0);
});

test("crea el grupo con el nombre recortado y actualiza la lista", async () => {
  const { controller, calls, events } = setup([
    { busGroup: GROUP },
    { busGroups: [GROUP] },
  ]);
  await controller.create({ name: "  Rutas largas ", category: "LONG_ROUTE" });
  assert.deepEqual(calls[0], [
    "/api/v1/bus-groups",
    { method: "POST", data: { name: "Rutas largas", category: "LONG_ROUTE" } },
  ]);
  assert.deepEqual(named(events, "created"), [["created", GROUP]]);
  assert.deepEqual(named(events, "status").at(-1), [
    "status",
    "Grupo «Rutas largas» creado.",
    "success",
  ]);
  assert.deepEqual(
    named(events, "busy").map(([, value]) => value),
    [true, false],
  );
});

test("valida en el cliente sin llamar a la API", async () => {
  const { controller, calls, events } = setup([]);
  await controller.create({ name: "   ", category: "LONG_ROUTE" });
  await controller.create({ name: "Rutas", category: "" });
  assert.equal(calls.length, 0);
  assert.deepEqual(
    named(events, "status").map(([, message]) => message),
    ["Escribe un nombre para el grupo.", "Elige la categoría del grupo."],
  );
});

test("explica el nombre repetido y conserva lo escrito", async () => {
  const { controller, events } = setup([
    apiError(409, "BUS_GROUP_ALREADY_EXISTS"),
  ]);
  await controller.create({ name: "Rutas largas", category: "LONG_ROUTE" });
  assert.equal(named(events, "created").length, 0);
  assert.match(named(events, "status").at(-1)[1], /Ya existe un grupo/);
});

test("no confirma un alta sin datos válidos en la respuesta", async () => {
  const { controller, events } = setup([{}]);
  await controller.create({ name: "Rutas largas", category: "LONG_ROUTE" });
  assert.equal(named(events, "created").length, 0);
  assert.match(named(events, "status").at(-1)[1], /No pudimos confirmar/);
});

test("evita dobles envíos mientras crea", async () => {
  let release;
  const { controller, calls } = setup([
    () => new Promise((resolve) => (release = resolve)),
    { busGroups: [GROUP] },
  ]);
  const first = controller.create({ name: "A", category: "CANTONAL" });
  await controller.create({ name: "A", category: "CANTONAL" });
  release({ busGroup: { ...GROUP, name: "A", category: "CANTONAL" } });
  await first;
  assert.equal(
    calls.filter(([, options]) => options.method === "POST").length,
    1,
  );
});

test("traduce las categorías de RN-11", () => {
  assert.equal(categoryLabel("CANTONAL"), "Rutas cantonales (estándar)");
  assert.equal(categoryLabel("URBAN_RURAL"), "Rutas urbanas o rurales");
});
