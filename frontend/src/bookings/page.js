import { createBenefitsApi } from "./benefits-api.js";
import { createBenefitBuyer } from "./benefits-controller.js";
import { createBookingAccess } from "./access.js";
import { createBookingsApi, readTripContext } from "./api.js";
import { createAttemptStore, createBookingFlow } from "./flow.js";
import { ApiError } from "../api/api-error.js";

const element = (id) => document.getElementById(id);
const api = createBookingsApi(window.fetch.bind(window));
const access = createBookingAccess({ api });
const benefitBuyer = createBenefitBuyer({
  api: createBenefitsApi(),
  newKey: () => window.crypto.randomUUID(),
});
let benefitBusy = false;
function forgetBenefits() {
  benefitBuyer.forget();
  element("benefit-buyer-status").textContent =
    "Completa los pasajeros antes de solicitar la revisión.";
}
function purchaseInput() {
  return {
    ...context,
    seatIds: [...selected],
    passengers: [...selected].map((seatId) => {
      const {
        deliveryEmail,
        guardianFullName,
        guardianBirthDate,
        ...passenger
      } = drafts.get(seatId);
      return {
        ...passenger,
        contact: {
          email: deliveryEmail,
          ...(guardianFullName || guardianBirthDate
            ? {
                guardian: {
                  fullName: guardianFullName,
                  birthDate: guardianBirthDate,
                },
              }
            : {}),
        },
      };
    }),
  };
}
async function benefitAction(refresh = false) {
  if (
    benefitBusy ||
    flow.state.locked ||
    !selected.size ||
    !element("passenger-form").reportValidity()
  )
    return;
  benefitBusy = true;
  element("benefit-buyer-status").textContent = "Consultando la revisión…";
  sync();
  try {
    const request = refresh
      ? await benefitBuyer.refresh()
      : await benefitBuyer.submit(purchaseInput());
    element("benefit-buyer-status").textContent =
      request.status === "EXPIRED"
        ? "El plazo terminó. Consulta nuevamente el viaje."
        : request.review
          ? "La revisión está registrada. Pulsa Ver resumen para consultar el total autorizado. Un dato no acreditado puede impedir continuar."
          : "Solicitud recibida. Presenta los documentos a la cooperativa y pulsa Consultar verificación.";
  } catch (error) {
    handleSessionFailure(error);
    element("benefit-buyer-status").textContent =
      !error.status || error.status >= 500
        ? "No pudimos confirmar la respuesta. Pulsa de nuevo para recuperar el mismo intento."
        : message(error);
  } finally {
    benefitBusy = false;
    sync();
  }
}

let loginRequired = false;
let hasCustomerSession = false;
const context = readTripContext(window.location.search);
const reservationReturn =
  "/pages/reservas.html" + (context ? "?" + new URLSearchParams(context) : "");
element("register-customer").href =
  "/pages/registro.html?" + new URLSearchParams({ next: reservationReturn });
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
function forgetPrivateView() {
  if (!flow) return;
  flow.forgetPrivateData();
  forgetBenefits();
  seats = [];
  selected.clear();
  drafts.clear();
  for (const id of [
    "seat-list",
    "passenger-fields",
    "summary-content",
    "receipt-content",
  ]) {
    element(id).replaceChildren();
  }
  for (const id of [
    "booking-reference",
    "booking-status",
    "booking-expiry",
    "booking-countdown",
  ]) {
    element(id).textContent = "";
  }
  element("accept-summary").checked = false;
  element("login-password").value = "";
  if (countdown) {
    window.clearInterval(countdown);
    countdown = undefined;
  }
}
function handleSessionFailure(error) {
  if (!flow || !["UNAUTHENTICATED", "FORBIDDEN"].includes(error.code)) return;
  loginRequired = true;
  hasCustomerSession = false;
  forgetPrivateView();
  element("booking-login").open = true;
}
async function resumeAfterAccess() {
  if (flow.state.reference) {
    notice("Consultando primero el intento pendiente de esta sesión…");
    await run(() => flow.recover());
  } else if (context) await loadSeats();
  else notice("Sesión iniciada. Elige un viaje para comenzar una reserva.");
}

function message(error) {
  if (error.code === "UNAUTHENTICATED") {
    return "Necesitas una sesión de cliente para continuar. Inicia sesión aquí; conservaremos la referencia de tu intento.";
  }
  if (error.code === "INVALID_CREDENTIALS")
    return "El correo o la contraseña no son correctos.";
  if (error.code === "VALIDATION_ERROR")
    return "Revisa el correo y la contraseña introducidos.";
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
    const label =
      seat.category === "ACCESSIBLE" ? "Espacio accesible " : "Asiento ";
    const status =
      seat.status === "AVAILABLE"
        ? chosen
          ? "✓ Elegido"
          : "Libre"
        : seat.status === "SOLD"
          ? "× Vendido"
          : "× Reservado";
    button.setAttribute("aria-label", label + seat.seatId + ", " + status);
    button.append(node("span", label + seat.seatId), node("small", status));
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
        deliveryEmail: "",
        guardianFullName: "",
        guardianBirthDate: "",
      });
    const draft = drafts.get(seatId);
    const fieldset = node("fieldset", undefined, "booking-passenger");
    fieldset.append(node("legend", "Asiento " + seatId));
    const grid = node("div", undefined, "booking-field-grid");
    for (const [field, label, type] of [
      ["fullName", "Nombre completo", "text"],
      ["identificationNumber", "Cédula (10 dígitos)", "text"],
      ["birthDate", "Fecha de nacimiento", "date"],
      [
        "deliveryEmail",
        "Correo de entrega: pasajero adulto o responsable del menor",
        "email",
      ],
      [
        "guardianFullName",
        "Si es menor al viajar: nombre del responsable adulto",
        "text",
      ],
      [
        "guardianBirthDate",
        "Si es menor al viajar: nacimiento del responsable adulto",
        "date",
      ],
    ]) {
      const wrapper = node("div", undefined, "booking-field");
      const id = "passenger-" + index + "-" + field;
      const caption = node("label", label);
      caption.htmlFor = id;
      const input = node("input");
      Object.assign(input, {
        id,
        type,
        required: !["guardianFullName", "guardianBirthDate"].includes(field),
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
    if (passenger.contact)
      item.append(
        node(
          "small",
          "Correo de entrega: " +
            passenger.contact.email +
            (passenger.contact.guardian
              ? " · Responsable: " + passenger.contact.guardian.fullName
              : ""),
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
  const busy = state.busy || loadingSeats || access.state.busy || benefitBusy;
  const locked =
    state.locked ||
    loadingSeats ||
    access.state.busy ||
    loginRequired ||
    benefitBusy;
  document
    .querySelector(".booking-workflow")
    .setAttribute("aria-busy", String(busy));
  for (const input of element("login-form").querySelectorAll("input, button"))
    input.disabled = busy;
  element("login-form").setAttribute("aria-busy", String(access.state.busy));
  element("login-summary").textContent = hasCustomerSession
    ? "Cambiar cuenta"
    : "Iniciar sesión";
  element("login-status").textContent = hasCustomerSession
    ? "Sesión de cliente activa."
    : "Accede con una cuenta existente de cliente.";
  for (const button of element("seat-list").querySelectorAll("button")) {
    button.disabled = locked || button.dataset.status !== "AVAILABLE";
  }
  for (const input of element("passenger-form").querySelectorAll("input"))
    input.disabled = locked;
  element("seat-panel").hidden =
    !seats.length || !!state.reference || !!state.booking;
  element("passenger-form").hidden =
    !selected.size || !!state.reference || !!state.booking;
  element("benefit-request-panel").hidden =
    !selected.size || !!state.reference || !!state.booking;
  element("request-benefit").disabled = locked || !selected.size;
  element("refresh-benefit").disabled = locked || !benefitBuyer.state.request;
  element("refresh-benefit").hidden = !benefitBuyer.state.request;
  element("summary-panel").hidden =
    !state.review || !!state.reference || !!state.booking;
  element("pending-panel").hidden = !state.reference || !!state.booking;
  element("receipt-panel").hidden = !state.booking;
  element("retry-attempt").hidden = !state.canRetry;
  element("refresh-seats").disabled = locked || !context;
  element("include-accessible").disabled = locked || !context;
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
        : booking.status === "SOLD"
          ? "Estado: compra aprobada. Tus boletos ya están disponibles."
          : "Estado pendiente de actualización.";
    element("booking-tickets").hidden = booking.status !== "SOLD";
    element("booking-not-ticket").hidden = booking.status === "SOLD";
    element("booking-tickets-link").href =
      "boletos.html?" + new URLSearchParams({ reserva: booking.bookingId });
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
  forgetBenefits();
  element("accept-summary").checked = false;
}
async function loadSeats() {
  if (!context || flow.state.reference) return;
  loadingSeats = true;
  notice("Consultando los asientos del viaje…");
  sync();
  try {
    const result = await api.availability(context);
    if (element("include-accessible").checked) {
      const accessible = await api.accessibleAvailability(context);
      if (
        !Array.isArray(accessible?.seats) ||
        accessible.seats.some((seat) => seat.category !== "ACCESSIBLE")
      )
        throw new ApiError(
          "RESPONSE_INVALID",
          "Inventario accesible inválido.",
        );
      result.seats = [...result.seats, ...accessible.seats];
    }
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
    loginRequired = false;
    hasCustomerSession = true;
    element("booking-login").open = false;
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
    handleSessionFailure(error);
    notice(message(error), "error", true);
    sync();
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
      loginRequired = false;
      hasCustomerSession = true;
      element("booking-login").open = false;
      sync();
      notice(
        "Tu reserva está registrada. Conserva su referencia y revisa el plazo indicado.",
        "success",
      );
      element("receipt-panel").focus();
    } else if (onSuccess) onSuccess();
  } catch (error) {
    if (!flow.state.review) element("accept-summary").checked = false;
    sync();
    handleSessionFailure(error);
    notice(message(error), "error", true);
    sync();
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
    ![
      "fullName",
      "identificationNumber",
      "birthDate",
      "deliveryEmail",
      "guardianFullName",
      "guardianBirthDate",
    ].includes(field)
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
  const input = purchaseInput();
  flow.invalidate();
  element("accept-summary").checked = false;
  run(
    () => flow.review(input),
    () => {
      notice("Revisa los pasajeros y el total calculado antes de aceptar.");
      element("summary-panel").focus();
    },
  );
});
element("request-benefit").addEventListener("click", () => benefitAction());
element("refresh-benefit").addEventListener("click", () => benefitAction(true));
window.addEventListener("pagehide", forgetBenefits);
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
element("include-accessible").addEventListener("change", loadSeats);
element("retry-availability").addEventListener("click", loadSeats);
element("finish-booking").addEventListener("click", (event) => {
  try {
    flow.finish();
  } catch (error) {
    event.preventDefault();
    handleSessionFailure(error);
    notice(message(error), "error", true);
    sync();
  }
});

element("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (
    !flow ||
    access.state.busy ||
    flow.state.busy ||
    loadingSeats ||
    !event.target.reportValidity()
  )
    return;
  const credentials = {
    email: element("login-email").value,
    password: element("login-password").value,
  };
  element("login-password").value = "";
  forgetPrivateView();
  loginRequired = true;
  hasCustomerSession = false;
  notice("Verificando tu acceso de cliente…");
  try {
    const pending = access.signIn(credentials);
    sync();
    await pending;
    loginRequired = false;
    hasCustomerSession = true;
    element("booking-login").open = false;
    sync();
    await resumeAfterAccess();
  } catch (error) {
    handleSessionFailure(error);
    element("booking-login").open = true;
    notice(message(error), "error", true);
  } finally {
    element("login-password").value = "";
    sync();
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
    handleSessionFailure(error);
    notice(message(error), "error", true);
    sync();
  }
}
boot();
