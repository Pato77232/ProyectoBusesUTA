import test from "node:test";
import assert from "node:assert/strict";
import {
  bookingOutcome,
  passengerSeatText,
  seatLabels,
} from "../../src/bookings/booking-outcome.js";
import { createHistoryController } from "../../src/bookings/history-controller.js";
import { proofMessage } from "../../src/bookings/payment-proof.js";

const NOW = Date.parse("2026-11-10T22:00:00-05:00");
const LATER = "2026-11-10T22:05:00-05:00";
const EARLIER = "2026-11-10T21:55:00-05:00";

test("una reserva pendiente dentro del plazo admite el comprobante", () => {
  const outcome = bookingOutcome(
    { status: "PENDING_PAYMENT", expiresAt: LATER },
    NOW,
  );
  assert.equal(outcome.status, "Estado: pendiente de comprobante.");
  assert.equal(outcome.canUploadProof, true);
  assert.equal(outcome.restart, false);
});

test("al terminar el plazo se retira el comprobante y se pide actualizar", () => {
  const outcome = bookingOutcome(
    { status: "PENDING_PAYMENT", expiresAt: EARLIER },
    NOW,
  );
  assert.equal(outcome.canUploadProof, false);
  assert.match(outcome.status, /plazo .* terminó/);
  assert.match(outcome.status, /Actualizar estado/);
});

test("rechazada y vencida explican el resultado y ofrecen empezar otra vez", () => {
  for (const [status, title, word] of [
    ["REJECTED", "El pago no fue aprobado", "rechazada"],
    ["EXPIRED", "La reserva venció", "vencida"],
  ]) {
    const outcome = bookingOutcome({ status, expiresAt: LATER }, NOW);
    assert.equal(outcome.title, title);
    assert.match(outcome.status, new RegExp("Estado: " + word));
    assert.match(outcome.status, /asientos se liberaron/);
    assert.equal(outcome.canUploadProof, false);
    assert.equal(outcome.restart, true);
    assert.equal(outcome.showTickets, false);
  }
});

test("una compra aprobada muestra sus boletos", () => {
  const outcome = bookingOutcome({ status: "SOLD", expiresAt: EARLIER }, NOW);
  assert.equal(outcome.showTickets, true);
  assert.equal(outcome.canUploadProof, false);
  assert.equal(outcome.restart, false);
});

test("un estado desconocido no permite acciones", () => {
  const outcome = bookingOutcome({ status: "OTRO" }, NOW);
  assert.equal(outcome.status, "Estado pendiente de actualización.");
  assert.equal(outcome.canUploadProof, false);
  assert.equal(outcome.restart, false);
});

test("el pasajero ve el número de asiento y nunca el identificador interno", () => {
  const labels = seatLabels([
    { seatId: "s-7", label: 7 },
    { seatId: "s-x", label: "7" },
    null,
  ]);
  assert.equal(passengerSeatText("s-7", labels), "asiento 7");
  assert.equal(passengerSeatText("s-x", labels), "asiento asignado");
  assert.equal(passengerSeatText("s-9", undefined), "asiento asignado");
});

test("subir un comprobante a una reserva cerrada explica que ya no se admite", () => {
  assert.match(
    proofMessage({ status: 409, code: "BOOKING_NOT_PAYABLE" }),
    /ya no admite comprobantes/,
  );
});

function historySetup(seatMap) {
  const states = [];
  const detail = {
    bookingId: "b-1",
    status: "REJECTED",
    createdAt: "2026-11-10T22:00:00-05:00",
    summary: {
      currency: "USD",
      totals: { totalPriceCents: 550 },
      passengers: [{ fullName: "Ana", seatId: "s-7" }],
      tripId: "t-1",
      fromPosition: 0,
      toPosition: 1,
    },
  };
  const calls = [];
  const api = {
    async request(path) {
      calls.push(path);
      if (path === "/api/v1/auth/me")
        return { user: { id: "u-1", role: "CUSTOMER" } };
      if (path.startsWith("/api/v1/bookings?"))
        return { bookings: { items: [detail], nextCursor: null } };
      if (path.startsWith("/api/v1/bookings/seat-map")) {
        if (seatMap instanceof Error) throw seatMap;
        return seatMap;
      }
      return { booking: detail };
    },
  };
  const controller = createHistoryController({
    api,
    render: (state) => states.push(state),
  });
  return { controller, states, calls };
}

test("el detalle del historial trae los números del mapa del viaje", async () => {
  const { controller, states, calls } = historySetup({
    seats: [{ seatId: "s-7", label: 7 }],
  });
  await controller.load();
  await controller.open("b-1");
  assert.ok(
    calls.includes(
      "/api/v1/bookings/seat-map?tripId=t-1&fromPosition=0&toPosition=1",
    ),
  );
  assert.equal(states.at(-1).seatLabels.get("s-7"), 7);
});

test("si el mapa no responde, el detalle se muestra igual sin números", async () => {
  const { controller, states } = historySetup(new Error("red"));
  await controller.load();
  await controller.open("b-1");
  assert.equal(states.at(-1).detail.bookingId, "b-1");
  assert.equal(states.at(-1).seatLabels.size, 0);
});
