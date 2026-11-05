import test from "node:test";
import assert from "node:assert/strict";
import {
  counterMessage,
  ownTrips,
  passengerProblem,
  saleRequest,
} from "../../src/counter/counter-model.js";
import { createCounterController } from "../../src/counter/counter-controller.js";

const COOP = "8f1c2a4e-0b7d-4f3e-9a51-3c2d1e0f9a87";
const OTHER = "1a2b3c4d-0b7d-4f3e-9a51-3c2d1e0f9a87";
const trip = (cooperativeId, tripId = "t-1") => ({
  tripId,
  cooperativeId,
  fromPosition: 0,
  toPosition: 1,
  origin: "Ambato",
  destination: "Quito",
  boardingAt: "2026-11-12T13:30:00Z",
  arrivalAt: "2026-11-12T16:00:00Z",
  amountCents: 550,
});
const passenger = (extra = {}) => ({
  seatId: "s-7",
  fullName: " Ana Caja ",
  identificationNumber: "1710034065",
  birthDate: "1990-05-10",
  birthDateVerified: true,
  disabilityVerified: false,
  ...extra,
});

test("solo ofrece los viajes de la cooperativa del oficinista", () => {
  const trips = [trip(COOP, "a"), trip(OTHER, "b"), trip(COOP.toUpperCase(), "c")];
  assert.deepEqual(
    ownTrips(trips, COOP).map((t) => t.tripId),
    ["a", "c"],
  );
  assert.deepEqual(ownTrips(trips, null), []);
});

test("explica qué falta en cada pasajero", () => {
  assert.equal(passengerProblem(passenger()), null);
  assert.match(passengerProblem(passenger({ fullName: " " })), /nombre/);
  assert.match(
    passengerProblem(passenger({ identificationNumber: "123" })),
    /10 dígitos/,
  );
  assert.match(passengerProblem(passenger({ birthDate: "" })), /nacimiento/);
  // BOOK-BENEF-02: la fecha ya no exige la marca; la cédula sí debe ser válida.
  assert.equal(passengerProblem(passenger({ birthDateVerified: false })), null);
  assert.match(
    passengerProblem(passenger({ identificationNumber: "1710034066" })),
    /no es válida/,
  );
});

test("arma la venta con pasajeros y verificaciones por asiento", () => {
  assert.deepEqual(
    saleRequest({ tripId: "t", fromPosition: 0, toPosition: 1 }, [passenger()]),
    {
      tripId: "t",
      fromPosition: 0,
      toPosition: 1,
      seatIds: ["s-7"],
      passengers: [
        {
          seatId: "s-7",
          identificationNumber: "1710034065",
          fullName: "Ana Caja",
          birthDate: "1990-05-10",
        },
      ],
      decisions: [
        { seatId: "s-7", birthDateVerified: true, disabilityVerified: false },
      ],
    },
  );
});

test("traduce los errores del servidor a indicaciones para el oficinista", () => {
  assert.match(
    counterMessage({ status: 409, code: "BOOKING_SEAT_CONFLICT" }),
    /se ocupó/,
  );
  assert.match(
    counterMessage({ status: 503, code: "BOOKING_CASH_UNCERTAIN" }),
    /mismo recibo/,
  );
  assert.match(
    counterMessage({ status: 409, code: "BOOKING_CASH_EXPIRED" }),
    /venta nueva/,
  );
  assert.match(counterMessage({ status: 403 }), /solo para oficinistas/);
  assert.match(
    counterMessage({ status: 403, code: "CSRF_TOKEN_INVALID" }),
    /otra vez/,
  );
  assert.match(counterMessage(new Error("red")), /conexión/);
});

function setup(overrides = {}) {
  const calls = [];
  const upcomingCalls = [];
  const notices = [];
  let id = 0;
  const api = {
    session: async () => ({
      user: { role: "CLERK", cooperative_id: COOP },
    }),
    searchTrips: async () => ({ trips: [trip(COOP), trip(OTHER, "x")] }),
    upcoming: async (input) => {
      upcomingCalls.push(input);
      return { trips: [trip(COOP, "d-1"), trip(OTHER, "d-x")], truncated: false };
    },
    seatMap: async () => ({
      seats: [
        { seatId: "s-7", label: 7, deck: 1, row: 0, column: 0, category: "NORMAL" },
        { seatId: "s-8", label: 8, deck: 1, row: 0, column: 1, category: "NORMAL" },
      ],
    }),
    availability: async () => ({
      seats: [
        { seatId: "s-7", status: "AVAILABLE" },
        { seatId: "s-8", status: "SOLD" },
      ],
    }),
    summary: async (body) => {
      calls.push(["summary", body]);
      return {
        summary: { totals: { totalPriceCents: 550 } },
        summaryRevision: "r".repeat(64),
      };
    },
    create: async (body, key) => {
      calls.push(["create", body, key]);
      return { booking: { bookingId: "b-1", expiresAt: "2026-11-12T13:00:00Z" } };
    },
    cash: async (bookingId, body) => {
      calls.push(["cash", bookingId, body]);
      return { sale: { status: "SOLD" } };
    },
    tickets: async () => ({ bookingId: "b-1", tickets: [{ code: "X" }] }),
    ...overrides,
  };
  const view = {
    render() {},
    notice: (message, kind) => notices.push([kind, message]),
    signedOut: (message) => notices.push(["signedOut", message]),
  };
  const controller = createCounterController({
    api,
    view,
    newId: () => `id-${++id}`,
    now: () => Date.parse("2026-11-11T15:00:00Z"),
  });
  return { controller, calls, notices, upcomingCalls };
}

test("venta completa: busca, elige, revisa, reserva, cobra y emite", async () => {
  const { controller, calls } = setup();
  await controller.start();
  await controller.search({ origin: "Ambato", destination: "Quito", date: "2026-11-12" });
  assert.equal(controller.state.trips.length, 1);
  await controller.chooseTrip(0);
  controller.toggleSeat("s-8");
  controller.toggleSeat("s-7");
  assert.deepEqual(controller.state.selected, ["s-7"]);
  await controller.review([passenger()]);
  await controller.confirm();
  await controller.pay();
  assert.equal(controller.state.sheet.tickets.length, 1);
  const create = calls.find(([name]) => name === "create");
  assert.equal(create[1].summaryAccepted, true);
  assert.equal(create[1].acceptedSummaryRevision, "r".repeat(64));
  assert.equal(create[2], "id-1");
  assert.deepEqual(calls.find(([name]) => name === "cash"), [
    "cash",
    "b-1",
    { cashReceiptId: "id-2", amountCents: 550 },
  ]);
});

test("un cobro incierto se reintenta con el mismo recibo", async () => {
  let attempts = 0;
  const receipts = [];
  const { controller, notices } = setup({
    cash: async (_, body) => {
      receipts.push(body.cashReceiptId);
      attempts += 1;
      if (attempts === 1)
        throw Object.assign(new Error(), { status: 503, code: "BOOKING_CASH_UNCERTAIN" });
      return { sale: { status: "SOLD" } };
    },
  });
  await controller.start();
  await controller.search({ origin: "A", destination: "B", date: "2026-11-12" });
  await controller.chooseTrip(0);
  controller.toggleSeat("s-7");
  await controller.review([passenger()]);
  await controller.confirm();
  await controller.pay();
  assert.equal(controller.state.sheet, null);
  assert.match(notices.at(-1)[1], /mismo recibo/);
  await controller.pay();
  assert.equal(receipts[0], receipts[1]);
  assert.ok(controller.state.sheet);
});

test("no envía pasajeros con una cédula que no pasa el dígito verificador", async () => {
  const { controller, calls, notices } = setup();
  await controller.start();
  await controller.search({ origin: "A", destination: "B", date: "2026-11-12" });
  await controller.chooseTrip(0);
  controller.toggleSeat("s-7");
  await controller.review([passenger({ identificationNumber: "1710034066" })]);
  assert.equal(calls.length, 0);
  assert.match(notices.at(-1)[1], /no es válida/);
});

test("pide iniciar sesión a quien no es oficinista", async () => {
  const { controller, notices } = setup({
    session: async () => ({ user: { role: "CUSTOMER", cooperative_id: null } }),
  });
  await controller.start();
  assert.equal(notices.at(-1)[0], "signedOut");
});

test("al entrar muestra la tabla de viajes de hoy de su cooperativa", async () => {
  const { controller, upcomingCalls } = setup();
  await controller.start();
  assert.deepEqual(upcomingCalls[0], {
    date: "2026-11-11",
    cooperativeId: COOP,
  });
  assert.equal(controller.state.day, "2026-11-11");
  assert.equal(controller.state.listMode, "day");
  assert.deepEqual(
    controller.state.trips.map((t) => t.tripId),
    ["d-1"],
  );
});

test("cambia de día sin volver a fechas pasadas", async () => {
  const { controller, upcomingCalls } = setup();
  await controller.start();
  await controller.nextDay();
  assert.equal(controller.state.day, "2026-11-12");
  await controller.previousDay();
  await controller.previousDay();
  assert.equal(controller.state.day, "2026-11-11");
  await controller.showDay("2026-11-20");
  assert.deepEqual(upcomingCalls.at(-1), {
    date: "2026-11-20",
    cooperativeId: COOP,
  });
});

test("desde la tabla del día se vende directo en el mapa de asientos", async () => {
  const { controller } = setup();
  await controller.start();
  await controller.chooseTrip(0);
  assert.equal(controller.state.trip.tripId, "d-1");
  assert.equal(controller.state.seats.length, 2);
});
