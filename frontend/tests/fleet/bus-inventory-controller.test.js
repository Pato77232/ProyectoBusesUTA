import assert from "node:assert/strict";
import { test } from "node:test";
import { createBusInventoryController } from "../../src/fleet/bus-inventory-controller.js";

const BUS_ID = "33333333-3333-4333-8333-333333333333";
const ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  role: "COOPERATIVE_ADMIN",
  cooperative_id: "22222222-2222-4222-8222-222222222222",
};
const SUMMARY = {
  id: BUS_ID,
  plate: "TBM-0013",
  unitNumber: 1,
  busGroupId: "44444444-4444-4444-8444-444444444444",
  busGroupName: "Rutas largas",
  capacity: 42,
  photoCount: 1,
};
const DETAIL = {
  id: BUS_ID,
  plate: "TBM-0013",
  vin: "VIN0013",
  unitNumber: 1,
  bodyworkBrand: "Marca",
  color: "Azul",
  busGroup: { id: SUMMARY.busGroupId, name: SUMMARY.busGroupName },
  seatLayout: { id: "SINGLE_DECK_2_2", version: 1, snapshot: {} },
  capacity: 42,
  seats: [
    {
      seatId: "55555555-5555-4555-8555-555555555555",
      layoutSeatKey: "deck-1-0-0",
      label: 1,
      deck: 1,
      row: 0,
      column: 0,
      category: "NORMAL",
      offered: true,
    },
  ],
  photos: [
    {
      id: "66666666-6666-4666-8666-666666666666",
      contentType: "image/png",
      size: 4,
      order: 0,
    },
  ],
};
const failure = (status, code) =>
  Object.assign(new Error(code), { status, code });

function fixture({ routes = {}, search = "" } = {}) {
  const calls = [];
  const events = [];
  const replies = {
    "GET /api/v1/auth/me": () => ({ user: ADMIN }),
    "GET /api/v1/buses": () => ({ buses: [SUMMARY] }),
    [`GET /api/v1/buses/${BUS_ID}`]: () => ({ bus: DETAIL }),
    ...routes,
  };
  const client = {
    async request(path, options = {}) {
      const key = `${options.method ?? "GET"} ${path}`;
      calls.push(key);
      return replies[key]();
    },
  };
  const record =
    (name) =>
    (...args) =>
      events.push([name, ...args]);
  const view = {
    loading: record("loading"),
    showList: record("showList"),
    showDetails: record("showDetails"),
    signedOut: record("signedOut"),
    blocked: record("blocked"),
    notFound: record("notFound"),
    failed: record("failed"),
  };
  const controller = createBusInventoryController({
    client,
    view,
    location: { search },
  });
  return { controller, calls, events };
}

const last = (events, name) =>
  events.filter(([event]) => event === name).at(-1);

test("verifica sesión antes de cargar el inventario real", async () => {
  const { controller, calls, events } = fixture();
  await controller.start();
  assert.deepEqual(calls, ["GET /api/v1/auth/me", "GET /api/v1/buses"]);
  assert.deepEqual(last(events, "showList"), ["showList", [SUMMARY]]);
});

test("una sesión de otro rol no consulta buses", async () => {
  const { controller, calls, events } = fixture({
    routes: {
      "GET /api/v1/auth/me": () => ({ user: { ...ADMIN, role: "CLERK" } }),
    },
  });
  await controller.start();
  assert.deepEqual(calls, ["GET /api/v1/auth/me"]);
  assert.match(last(events, "blocked")[1], /administrador de cooperativa/);
});

test("sin sesión ofrece iniciar sesión", async () => {
  const { controller, events } = fixture({
    routes: {
      "GET /api/v1/auth/me": () =>
        Promise.reject(failure(401, "UNAUTHENTICATED")),
    },
  });
  await controller.start();
  assert.match(last(events, "signedOut")[1], /Inicia sesión/);
});

test("abre una ficha únicamente con la respuesta completa del servidor", async () => {
  const { controller, calls, events } = fixture({ search: `?id=${BUS_ID}` });
  await controller.start();
  assert.deepEqual(calls, [
    "GET /api/v1/auth/me",
    `GET /api/v1/buses/${BUS_ID}`,
  ]);
  assert.deepEqual(last(events, "showDetails"), ["showDetails", DETAIL]);
});

test("bus ajeno o inexistente vuelve al mensaje de no disponible", async () => {
  const { controller, events } = fixture({
    search: `?id=${BUS_ID}`,
    routes: {
      [`GET /api/v1/buses/${BUS_ID}`]: () =>
        Promise.reject(failure(404, "BUS_NOT_FOUND")),
    },
  });
  await controller.start();
  assert.match(last(events, "notFound")[1], /ya no están disponibles/);
});

test("respuesta incompleta no se presenta como ficha válida", async () => {
  const { controller, events } = fixture({
    routes: { "GET /api/v1/buses": () => ({ buses: [{ id: BUS_ID }] }) },
  });
  await controller.start();
  assert.match(last(events, "failed")[1], /No pudimos cargar el inventario/);
});
