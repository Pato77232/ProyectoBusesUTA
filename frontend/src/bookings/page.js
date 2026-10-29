import { createBookingsApi, readTripContext } from "./api.js";
import { createAttemptStore, createBookingFlow } from "./flow.js";
import { ApiError } from "../api/api-error.js";

const element = (id) => document.getElementById(id);
const api = createBookingsApi(window.fetch.bind(window));
const context = readTripContext(window.location.search);
const selected = new Set();
const drafts = new Map();
let seats = [];
let flow;
let loadingSeats = false;
let countdown;
const usd = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
});
const dateFormat = new Intl.DateTimeFormat("es-EC", {
  timeZone: "America/Guayaquil",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const instantFormat = new Intl.DateTimeFormat("es-EC", {
  timeZone: "America/Guayaquil",
  dateStyle: "medium",
  timeStyle: "short",
});
const money = (cents) => usd.format(cents / 100);

function node(tag, text, className) {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  if (className) result.className = className;
  return result;
}
function notice(text, tone = "info", focus = false) {
  const target = element("booking-notice");
  target.textContent = text;
  target.dataset.tone = tone;
  if (focus) target.focus();
}
function message(error) {
  if (error.code === "UNAUTHENTICATED") {
    return "Necesitas una sesión de cliente para continuar. El acceso de clientes aún está en preparación.";
  }
  if (error.code === "BOOKING_ATTEMPT_NOT_FOUND") {
    return "Todavía no encontramos un resultado para esta sesión. Conservamos la referencia: vuelve a consultar antes de iniciar otra compra.";
  }
  if (error.code === "CSRF_TOKEN_INVALID")
    return "La protección del formulario cambió. Vuelve a intentar; renovaremos la protección.";
  if (error.code === "BOOKING_SUMMARY_CHANGED")
    return "El resumen cambió. Revisa tus datos y solicita un resumen nuevo antes de confirmar.";
  if (error.code === "BOOKING_SEAT_CONFLICT")
    return "Uno o varios asientos ya no están libres. Actualiza la disponibilidad y revisa la selección.";
  if (error.code === "BOOKING_REQUEST_KEY_REUSED")
    return "La referencia está vinculada a otros datos de compra. Consulta su resultado; no inicies otra compra para reemplazarla.";
  if (error.code === "BOOKING_BENEFIT_REVIEW_REQUIRED")
    return "La tarifa preferencial necesita revisión de la acreditación. Tus datos siguen en esta pantalla.";
  if (error.code === "FORBIDDEN")
    return "Esta reserva requiere una sesión de cliente.";
  if (
    flow?.state.reference &&
    !flow.state.booking &&
    (error.status >= 500 || !error.status)
  ) {
    return "No pudimos confirmar la respuesta. Conservamos el mismo intento para consultar su resultado sin duplicar la compra.";
  }
  if (error.status >= 500)
    return "La reserva todavía no está disponible. Intenta consultar de nuevo más tarde.";
  return error.message || "No se pudo completar la acción. Inténtalo de nuevo.";
}
function renderSeats() {
  const list = element("seat-list");
  list.replaceChildren();
  for (const seat of seats) {
    const chosen = selected.has(seat.seatId);
    const button = node("button", undefined, "booking-seat");
    button.type = "button";
    button.dataset.seatId = seat.seatId;
    button.dataset.status = seat.status;
    button.setAttribute("aria-pressed", String(chosen));
    const status =
      seat.status === "AVAILABLE"
        ? chosen
          ? "✓ Elegido"
          : "Libre"
        : seat.status === "SOLD"
          ? "× Vendido"
          : "× Reservado";
    button.setAttribute("aria-label", "Asiento " + seat.seatId + ", " + status);
    button.append(node("span", seat.seatId), node("small", status));
    list.append(button);
  }
  element("selection-count").textContent = selected.size
    ? selected.size +
      (selected.size === 1 ? " asiento elegido." : " asientos elegidos.")
    : "Aún no has elegido un asiento.";
}
function renderPassengers() {
  const container = element("passenger-fields");
  container.replaceChildren();
  [...selected].forEach((seatId, index) => {
    if (!drafts.has(seatId))
      drafts.set(seatId, {
        seatId,
        fullName: "",
        identificationNumber: "",
        birthDate: "",
      });
    const draft = drafts.get(seatId);
    const fieldset = node("fieldset", undefined, "booking-passenger");
    fieldset.append(node("legend", "Asiento " + seatId));
    const grid = node("div", undefined, "booking-field-grid");
    for (const [field, label, type] of [
      ["fullName", "Nombre completo", "text"],
      ["identificationNumber", "Cédula (10 dígitos)", "text"],
      ["birthDate", "Fecha de nacimiento", "date"],
    ]) {
      const wrapper = node("div", undefined, "booking-field");
      const id = "passenger-" + index + "-" + field;
      const caption = node("label", label);
      caption.htmlFor = id;
      const input = node("input");
      Object.assign(input, {
        id,
        type,
        required: true,
        value: draft[field],
        autocomplete: "off",
      });
      input.dataset.seatId = seatId;
      input.dataset.field = field;
      if (field === "identificationNumber") {
        input.pattern = "[0-9]{10}";
        input.maxLength = 10;
        input.inputMode = "numeric";
      }
      wrapper.append(caption, input);
      if (field === "fullName") fieldset.append(wrapper);
      else grid.append(wrapper);
    }
    fieldset.append(grid);
    container.append(fieldset);
  });
}
function renderSummary(target, summary) {
  target.replaceChildren();
  const departure = new Date(summary.departureDate + "T12:00:00Z");
  target.append(node("p", "Salida: " + dateFormat.format(departure)));
  const passengers = node("ul", undefined, "booking-summary-passengers");
  for (const passenger of summary.passengers) {
    const item = node("li");
    item.append(
      node("strong", passenger.fullName + " · asiento " + passenger.seatId),
      node(
        "small",
        "Cédula " +
          passenger.identificationNumber +
          " · Nacimiento " +
          passenger.birthDate +
          " · " +
          money(passenger.quote.totalPriceCents),
      ),
    );
    passengers.append(item);
  }
  const totals = node("dl", undefined, "booking-totals");
  for (const [label, field, className] of [
    ["Tarifa base", "basePriceCents", ""],
    ["Descuento aplicado", "discountCents", ""],
    ["Total (USD)", "totalPriceCents", "booking-total"],
  ]) {
    const row = node("div", undefined, className);
    row.append(node("dt", label), node("dd", money(summary.totals[field])));
    totals.append(row);
  }
  target.append(passengers, totals);
}
function tick() {
  const booking = flow?.state.booking;
  if (!booking) return;
  const remaining = Math.max(
    0,
    Math.ceil((Date.parse(booking.expiresAt) - Date.now()) / 1000),
  );
  element("booking-countdown").textContent =
    booking.status !== "PENDING_PAYMENT"
      ? "Consulta el estado y las indicaciones actuales de la reserva."
      : remaining > 0
        ? "Plazo orientativo restante: " +
          Math.floor(remaining / 60) +
          ":" +
          String(remaining % 60).padStart(2, "0")
        : "El plazo indicado terminó. Actualiza el estado antes de continuar.";
}
function sync() {
  if (!flow) return;
  const state = flow.state;
  const busy = state.busy || loadingSeats;
  const locked = state.locked || loadingSeats;
  document
    .querySelector(".booking-workflow")
    .setAttribute("aria-busy", String(busy));
  for (const button of element("seat-list").querySelectorAll("button")) {
    button.disabled = locked || button.dataset.status !== "AVAILABLE";
  }
  for (const input of element("passenger-form").querySelectorAll("input"))
    input.disabled = locked;
  element("seat-panel").hidden =
    !seats.length || !!state.reference || !!state.booking;
  element("passenger-form").hidden =
    !selected.size || !!state.reference || !!state.booking;
  element("summary-panel").hidden =
    !state.review || !!state.reference || !!state.booking;
  element("pending-panel").hidden = !state.reference || !!state.booking;
  element("receipt-panel").hidden = !state.booking;
  element("retry-attempt").hidden = !state.canRetry;
  element("refresh-seats").disabled = locked || !context;
  element("retry-availability").hidden =
    !context ||
    seats.length > 0 ||
    !!state.reference ||
    !!state.booking ||
    loadingSeats;
  element("retry-availability").disabled = busy;
  element("review-button").disabled = locked || !selected.size;
  element("edit-details").disabled = locked;
  element("accept-summary").disabled = locked;
  element("confirm-booking").disabled =
    locked || !element("accept-summary").checked || !state.review;
  for (const id of ["recover-attempt", "retry-attempt", "refresh-booking"])
    element(id).disabled = busy;
  if (state.review)
    renderSummary(element("summary-content"), state.review.summary);
  if (state.booking) {
    const booking = state.booking;
    element("booking-reference").textContent = booking.bookingId;
    element("booking-status").textContent =
      booking.status === "PENDING_PAYMENT"
        ? "Estado: pendiente de comprobante."
        : "Estado pendiente de actualización.";
    element("booking-expiry").dateTime = booking.expiresAt;
    element("booking-expiry").textContent =
      instantFormat.format(new Date(booking.expiresAt)) + " · hora de Ecuador";
    renderSummary(element("receipt-content"), booking.summary);
    tick();
    if (!countdown) countdown = window.setInterval(tick, 1000);
  }
  const current =
    state.review || state.booking
      ? "summary"
      : selected.size
        ? "passengers"
        : "seats";
  for (const step of document.querySelectorAll("[data-step]")) {
    if (step.dataset.step === current)
      step.setAttribute("aria-current", "step");
    else step.removeAttribute("aria-current");
  }
}
function invalidate() {
  flow.invalidate();
  element("accept-summary").checked = false;
}
async function loadSeats() {
  if (!context || flow.state.reference) return;
  loadingSeats = true;
  notice("Consultando los asientos del viaje…");
  sync();
  try {
    const result = await api.availability(context);
    if (
      !Array.isArray(result?.seats) ||
      result.seats.some(
        (seat) =>
          typeof seat?.seatId !== "string" ||
          !seat.seatId ||
          !["AVAILABLE", "RESERVED", "SOLD"].includes(seat.status),
      ) ||
      new Set(result.seats.map((seat) => seat.seatId)).size !==
        result.seats.length
    ) {
      throw new ApiError(
        "RESPONSE_INVALID",
        "No se pudo leer la disponibilidad del viaje.",
      );
    }
    seats = result.seats;
    for (const seatId of selected) {
      if (
        !seats.some(
          (seat) => seat.seatId === seatId && seat.status === "AVAILABLE",
        )
      )
        selected.delete(seatId);
    }
    invalidate();
    renderSeats();
    renderPassengers();
    notice(
      seats.some((seat) => seat.status === "AVAILABLE")
        ? "Elige tus asientos para continuar con los pasajeros."
        : "No hay asientos libres para este tramo. Puedes actualizar la consulta.",
    );
  } catch (error) {
    notice(message(error), "error", true);
  } finally {
    loadingSeats = false;
    sync();
  }
}
async function run(action, onSuccess) {
  try {
    const pending = action();
    sync();
    await pending;
    sync();
    if (flow.state.booking) {
      notice(
        "Tu reserva está registrada. Conserva su referencia y revisa el plazo indicado.",
        "success",
      );
      element("receipt-panel").focus();
    } else if (onSuccess) onSuccess();
  } catch (error) {
    if (!flow.state.review) element("accept-summary").checked = false;
    sync();
    notice(message(error), "error", true);
  }
}
element("seat-list").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-seat-id]");
  if (!button || button.disabled || flow.state.locked) return;
  const seatId = button.dataset.seatId;
  if (selected.has(seatId)) selected.delete(seatId);
  else selected.add(seatId);
  invalidate();
  renderSeats();
  renderPassengers();
  sync();
  element("seat-list")
    .querySelectorAll("button")
    .forEach((next) => {
      if (next.dataset.seatId === seatId) next.focus();
    });
});
element("passenger-form").addEventListener("input", (event) => {
  const { seatId, field } = event.target.dataset;
  if (
    !drafts.has(seatId) ||
    !["fullName", "identificationNumber", "birthDate"].includes(field)
  )
    return;
  drafts.get(seatId)[field] = event.target.value;
  invalidate();
  sync();
});
element("passenger-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!selected.size || flow.state.locked || !event.target.reportValidity())
    return;
  const input = {
    ...context,
    seatIds: [...selected],
    passengers: [...selected].map((seatId) => ({ ...drafts.get(seatId) })),
  };
  invalidate();
  run(
    () => flow.review(input),
    () => {
      notice("Revisa los pasajeros y el total calculado antes de aceptar.");
      element("summary-panel").focus();
    },
  );
});
element("accept-summary").addEventListener("change", sync);
element("edit-details").addEventListener("click", () => {
  invalidate();
  sync();
  element("passenger-form").querySelector("input")?.focus();
});
element("confirm-booking").addEventListener("click", () =>
  run(() => flow.confirm(element("accept-summary").checked)),
);
element("recover-attempt").addEventListener("click", () =>
  run(() => flow.recover()),
);
element("retry-attempt").addEventListener("click", () =>
  run(() => flow.retry()),
);
element("refresh-booking").addEventListener("click", () =>
  run(() => flow.recover()),
);
element("refresh-seats").addEventListener("click", loadSeats);
element("retry-availability").addEventListener("click", loadSeats);
element("finish-booking").addEventListener("click", (event) => {
  try {
    flow.finish();
  } catch (error) {
    event.preventDefault();
    notice(message(error), "error", true);
  }
});

async function boot() {
  try {
    flow = createBookingFlow({
      api,
      attemptStore: createAttemptStore(window.sessionStorage),
      newKey: () => window.crypto.randomUUID(),
    });
    sync();
    if (flow.state.reference) {
      notice("Consultando el resultado del intento guardado en esta pestaña…");
      await run(() => flow.recover());
    } else if (context) await loadSeats();
    else
      notice(
        "Elige primero un viaje para reservar. La búsqueda de viajes aún está en preparación; puedes volver al inicio.",
      );
  } catch (error) {
    notice(message(error), "error", true);
  }
}
boot();
