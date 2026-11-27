import test from "node:test";
import assert from "node:assert/strict";
import {
  RECENT_TRIPS_SHOWN,
  splitTrips,
  toTrip,
  tripAction,
} from "../../src/bookings/customer-dashboard.js";
import { createDashboardController } from "../../src/bookings/dashboard-controller.js";

const NOW = Date.parse("2026-11-10T12:00:00Z");
function booking(id, status, departureAt, extra = {}) {
  return {
    bookingId: id,
    status,
    fromPosition: 0,
    toPosition: 1,
    totalPriceCents: 550,
    summary: {
      passengers: [{}, {}],
      commercial: {
        routePoints: [
          { position: 0, locationKey: "Ambato", departureAt },
          { position: 1, locationKey: "Quito", arrivalAt: departureAt },
        ],
      },
    },
    ...extra,
  };
}

test("convierte una reserva en un viaje con su tramo y estado", () => {
  assert.deepEqual(toTrip(booking("a", "SOLD", "2026-11-12T13:30:00Z")), {
    bookingId: "a",
    status: "SOLD",
    statusLabel: "Pagado",
    origin: "Ambato",
    destination: "Quito",
    departureAt: "2026-11-12T13:30:00Z",
    departure: Date.parse("2026-11-12T13:30:00Z"),
    passengers: 2,
    totalPriceCents: 550,
  });
});

test("omite reservas sin recorrido verificable en vez de inventarlo", () => {
  assert.equal(toTrip(booking("a", "SOLD", "no-es-fecha")), null);
  assert.equal(
    toTrip({ ...booking("a", "SOLD", "2026-11-12T13:30:00Z"), summary: {} }),
    null,
  );
  assert.equal(toTrip(booking("a", "OTRO", "2026-11-12T13:30:00Z")), null);
});

test("separa próximos viajes activos de los recientes", () => {
  const { upcoming, recent } = splitTrips(
    [
      booking("lejano", "SOLD", "2026-12-01T13:00:00Z"),
      booking("cercano", "PENDING_PAYMENT", "2026-11-11T13:00:00Z"),
      booking("vencida", "EXPIRED", "2026-11-12T13:00:00Z"),
      booking("pasado", "SOLD", "2026-11-01T13:00:00Z"),
    ],
    NOW,
  );
  assert.deepEqual(
    upcoming.map((trip) => trip.bookingId),
    ["cercano", "lejano"],
  );
  assert.deepEqual(
    recent.map((trip) => trip.bookingId),
    ["vencida", "pasado"],
  );
});

test("limita los viajes recientes mostrados", () => {
  const items = Array.from({ length: RECENT_TRIPS_SHOWN + 3 }, (_, index) =>
    booking(
      "b" + index,
      "EXPIRED",
      `2026-10-${String(index + 1).padStart(2, "0")}T13:00:00Z`,
    ),
  );
  assert.equal(splitTrips(items, NOW).recent.length, RECENT_TRIPS_SHOWN);
  assert.deepEqual(splitTrips(undefined, NOW), { upcoming: [], recent: [] });
});

test("enlaza los boletos de una compra pagada y la reserva en otros casos", () => {
  assert.deepEqual(tripAction({ status: "SOLD", bookingId: "x 1" }), {
    href: "/pages/boletos.html?reserva=x+1",
    label: "Ver boletos",
  });
  assert.equal(
    tripAction({ status: "EXPIRED" }).href,
    "/pages/historial-reservas.html",
  );
});

function controllerSetup(responses) {
  const events = [];
  const calls = [];
  const client = {
    async request(path, options) {
      calls.push([path, options]);
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return next;
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
    events,
    calls,
    controller: createDashboardController({ client, view, now: () => NOW }),
  };
}

test("el panel saluda al cliente y muestra sus viajes", async () => {
  const { events, calls, controller } = controllerSetup([
    { user: { role: "CUSTOMER", email: "cliente@example.test" } },
    { bookings: { items: [booking("a", "SOLD", "2026-11-12T13:30:00Z")] } },
  ]);
  await controller.start();
  assert.deepEqual(
    calls.map(([path]) => path),
    ["/api/v1/auth/me", "/api/v1/bookings?limit=50"],
  );
  assert.deepEqual(
    events.find(([name]) => name === "greet"),
    ["greet", "cliente@example.test"],
  );
  assert.equal(events.find(([name]) => name === "trips")[1].upcoming.length, 1);
});

test("el panel pide iniciar sesión a otros roles y a sesiones vencidas", async () => {
  const other = controllerSetup([
    { user: { role: "CLERK", email: "o@example.test" } },
  ]);
  await other.controller.start();
  assert.equal(other.calls.length, 1);
  assert.equal(other.events.at(-1)[0], "signedOut");
  const expired = controllerSetup([
    Object.assign(new Error(), { status: 401 }),
  ]);
  await expired.controller.start();
  assert.equal(expired.events.at(-1)[0], "signedOut");
});

test("el panel informa una respuesta de historial inválida", async () => {
  const { events, controller } = controllerSetup([
    { user: { role: "CUSTOMER", email: "c@example.test" } },
    { bookings: {} },
  ]);
  await controller.start();
  assert.equal(events.at(-1)[0], "failed");
});

test("cerrar sesión vuelve al login aunque se pierda la respuesta", async () => {
  const { events, calls, controller } = controllerSetup([new Error("red")]);
  await controller.logout();
  assert.deepEqual(calls[0], ["/api/v1/auth/logout", { method: "POST" }]);
  assert.deepEqual(events.at(-1), ["leave", "/pages/login.html"]);
});
