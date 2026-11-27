import { createApiClient } from "../api/api-client.js";
import { groupByDeck, seatName } from "../bookings/seat-map.js";
import { createCounterApi } from "./counter-api.js";
import { createCounterController } from "./counter-controller.js";
import { money } from "./counter-model.js";
import { dayLabel, stopsText } from "../search/upcoming.js";

const element = (id) => document.getElementById(id);
const ZONE = "America/Guayaquil";
const dateTime = new Intl.DateTimeFormat("es-EC", {
  timeZone: ZONE,
  dateStyle: "medium",
  timeStyle: "short",
});
const hour = new Intl.DateTimeFormat("es-EC", {
  timeZone: ZONE,
  timeStyle: "short",
});

function node(tag, text, className) {
  const created = document.createElement(tag);
  if (text !== undefined) created.textContent = text;
  if (className) created.className = className;
  return created;
}

function field(id, label, input) {
  const wrapper = node("div");
  const labelNode = node("label", label, "form-label");
  labelNode.htmlFor = id;
  input.id = id;
  wrapper.append(labelNode, input);
  return wrapper;
}

function check(id, label) {
  const wrapper = node("div", undefined, "form-check");
  const input = node("input", undefined, "form-check-input");
  input.type = "checkbox";
  input.id = id;
  const labelNode = node("label", label, "form-check-label");
  labelNode.htmlFor = id;
  wrapper.append(input, labelNode);
  return wrapper;
}

const seatLabel = (state, seatId) => {
  const seat = state.seats.find((s) => s.seatId === seatId);
  return seat ? seatName(seat) : "Asiento";
};

function cell(text) {
  return node("td", text);
}

// SEARCH-02: tabla de viajes del día (o del tramo buscado) de la cooperativa.
function renderTrips(state) {
  const list = element("trip-list");
  list.replaceChildren();
  state.trips.forEach((trip, index) => {
    const row = node("tr");
    if (state.trip === trip) row.setAttribute("aria-current", "true");
    const action = node("td");
    const button = node("button", "Vender", "btn btn-dark btn-sm");
    button.type = "button";
    button.dataset.index = String(index);
    button.disabled = state.busy || !!state.booking || !!state.review;
    button.setAttribute(
      "aria-label",
      `Vender ${trip.origin} → ${trip.destination}, salida ${hour.format(new Date(trip.boardingAt))}`,
    );
    action.append(button);
    row.append(
      cell(hour.format(new Date(trip.boardingAt))),
      cell(hour.format(new Date(trip.arrivalAt))),
      cell(`${trip.origin} → ${trip.destination}`),
      cell(
        Number.isSafeInteger(trip.stopCount)
          ? stopsText(trip.stopCount)
          : "Tramo buscado",
      ),
      cell(money.format(trip.amountCents / 100)),
      action,
    );
    list.append(row);
  });
  if (!state.trips.length) {
    const row = node("tr");
    const empty = node("td", "Sin viajes para mostrar.", "counter-muted");
    empty.colSpan = 6;
    row.append(empty);
    list.append(row);
  }
  element("trip-caption").textContent =
    state.listMode === "search"
      ? "Tramo buscado con el formulario."
      : state.day
        ? `${dayLabel(state.day)} · ${state.trips.length} ${state.trips.length === 1 ? "viaje" : "viajes"}`
        : "";
  if (state.day && element("day-date").value !== state.day)
    element("day-date").value = state.day;
  element("day-previous").disabled = state.busy || !!state.booking;
  element("day-next").disabled = state.busy || !!state.booking;
  element("day-today").disabled = state.busy || !!state.booking;
}

function seatButton(state, seat) {
  const chosen = state.selected.includes(seat.seatId);
  const button = node("button", undefined, "booking-seat");
  button.type = "button";
  button.dataset.seatId = seat.seatId;
  button.dataset.status = seat.status;
  if (seat.category === "VIP") button.dataset.category = "VIP";
  button.setAttribute("aria-pressed", String(chosen));
  const status =
    seat.status === "AVAILABLE"
      ? chosen
        ? "✓ Elegido"
        : "Libre"
      : seat.status === "SOLD"
        ? "× Vendido"
        : "× Reservado";
  button.setAttribute("aria-label", `${seatName(seat)}, ${status}`);
  button.disabled =
    state.busy || seat.status !== "AVAILABLE" || !!state.review || !!state.booking;
  button.append(node("span", String(seat.label)), node("small", status));
  button.style.gridRowStart = String(seat.row + 1);
  button.style.gridColumnStart = String(seat.column + 1);
  return button;
}

function renderSeats(state) {
  const list = element("seat-list");
  list.replaceChildren();
  const decks = groupByDeck(state.seats);
  for (const { deck, seats } of decks) {
    const section = node("section", undefined, "booking-deck");
    const title =
      decks.length > 1
        ? deck === 2
          ? "Piso superior"
          : "Piso inferior"
        : "Distribución del bus";
    section.setAttribute("aria-label", title);
    const grid = node("div", undefined, "booking-deck-grid");
    for (const seat of seats) grid.append(seatButton(state, seat));
    section.append(node("h3", title, "booking-deck-title"), grid);
    list.append(section);
  }
}

// Conserva lo escrito al redibujar: solo agrega o quita los pasajeros que cambian.
function renderPassengers(state) {
  const list = element("passenger-list");
  const present = new Map(
    [...list.children].map((child) => [child.dataset.seatId, child]),
  );
  for (const [seatId, child] of present)
    if (!state.selected.includes(seatId)) child.remove();
  state.selected.forEach((seatId, index) => {
    if (present.has(seatId) && list.contains(present.get(seatId))) return;
    const prefix = `p-${index}-${seatId.slice(0, 8)}`;
    const box = node("fieldset", undefined, "counter-passenger");
    box.dataset.seatId = seatId;
    box.append(node("legend", seatLabel(state, seatId)));
    const name = node("input", undefined, "form-control");
    name.name = "fullName";
    name.autocomplete = "off";
    const cedula = node("input", undefined, "form-control");
    cedula.name = "identificationNumber";
    cedula.inputMode = "numeric";
    cedula.maxLength = 10;
    cedula.autocomplete = "off";
    const birth = node("input", undefined, "form-control");
    birth.name = "birthDate";
    birth.type = "date";
    const grid = node("div", undefined, "counter-passenger-grid");
    grid.append(
      field(`${prefix}-name`, "Nombre completo", name),
      field(`${prefix}-cedula`, "Cédula (10 dígitos)", cedula),
      field(`${prefix}-birth`, "Fecha de nacimiento", birth),
    );
    box.append(
      grid,
      check(
        `${prefix}-birth-ok`,
        "Comprobé la fecha de nacimiento con la cédula física",
      ),
      check(
        `${prefix}-disability-ok`,
        "Comprobé la acreditación de discapacidad (si aplica)",
      ),
    );
    list.append(box);
  });
  for (const input of list.querySelectorAll("input"))
    input.disabled = state.busy || !!state.review || !!state.booking;
}

function readPassengers() {
  return [...element("passenger-list").children].map((box) => {
    const checks = box.querySelectorAll("input[type=checkbox]");
    return {
      seatId: box.dataset.seatId,
      fullName: box.querySelector("[name=fullName]").value,
      identificationNumber: box.querySelector("[name=identificationNumber]").value,
      birthDate: box.querySelector("[name=birthDate]").value,
      birthDateVerified: checks[0].checked,
      disabilityVerified: checks[1].checked,
    };
  });
}

function renderReview(state) {
  const target = element("review-content");
  target.replaceChildren();
  if (!state.review) return;
  const summary = state.review.summary;
  const list = node("ul", undefined, "counter-review");
  for (const passenger of summary.passengers ?? []) {
    const item = node("li");
    item.append(
      node("strong", passenger.fullName),
      node(
        "span",
        `${seatLabel(state, passenger.seatId)} · Cédula ${passenger.identificationNumber}`,
      ),
    );
    list.append(item);
  }
  const totals = node("dl", undefined, "counter-totals");
  for (const [label, key] of [
    ["Tarifa base", "basePriceCents"],
    ["Recargo VIP", "vipSurchargeCents"],
    ["Descuento", "discountCents"],
    ["Total", "totalPriceCents"],
  ]) {
    if (summary.totals?.[key] === undefined) continue;
    const row = node("div");
    row.append(node("dt", label), node("dd", money.format(summary.totals[key] / 100)));
    totals.append(row);
  }
  target.append(list, totals);
}

function qrImage(ticket) {
  const image = node("img", undefined, "counter-qr");
  image.src =
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(ticket.qrSvg);
  image.alt = `Código QR del boleto ${ticket.code}`;
  image.width = 160;
  image.height = 160;
  return image;
}

function renderTickets(state) {
  const list = element("ticket-list");
  list.replaceChildren();
  const sheet = state.sheet;
  if (!sheet) return;
  sheet.tickets.forEach((ticket, index) => {
    const card = node("article", undefined, "counter-ticket");
    const data = node("div");
    data.append(
      node("p", `Boleto ${index + 1} de ${sheet.tickets.length}`, "eyebrow"),
      node(
        "h3",
        `${sheet.trip.origin.locationKey} → ${sheet.trip.destination.locationKey}`,
      ),
      node("p", `Salida: ${dateTime.format(new Date(sheet.trip.origin.departureAt))}`),
      node("p", `Pasajero: ${ticket.passenger.fullName}`),
      node("p", `Cédula: ${ticket.passenger.identificationNumber}`),
      node("p", `${seatLabel(state, ticket.seatId)} · ${money.format(ticket.totalPriceCents / 100)}`),
      node("p", `Código: ${ticket.code}`, "counter-code"),
    );
    card.append(data, qrImage(ticket));
    list.append(card);
  });
}

const view = {
  notice(message, kind) {
    const status = element("counter-status");
    status.textContent = message;
    status.dataset.kind = kind;
  },
  signedOut(message) {
    view.notice(message, "error");
    element("counter-login").hidden = false;
    element("search-section").hidden = true;
  },
  render(state) {
    element("search-section").hidden = !state.cooperativeId;
    element("search-submit").disabled = state.busy;
    renderTrips(state);
    const showSeats = !!state.trip && !state.sheet;
    element("seat-section").hidden = !showSeats;
    element("refresh-seats").disabled = state.busy || !!state.booking;
    if (state.trip)
      element("seat-trip").textContent = `${state.trip.origin} → ${state.trip.destination} · ${dateTime.format(new Date(state.trip.boardingAt))}`;
    renderSeats(state);
    element("passenger-form").hidden = !state.selected.length || !!state.sheet;
    renderPassengers(state);
    element("review-submit").disabled =
      state.busy || !!state.review || !!state.booking;
    element("review-section").hidden = !state.review || !!state.booking;
    renderReview(state);
    element("edit-sale").disabled = state.busy;
    element("confirm-sale").disabled = state.busy;
    const paying = !!state.booking && !state.sheet;
    element("pay-section").hidden = !paying;
    if (state.booking && state.review) {
      element("pay-total").textContent = money.format(
        state.review.summary.totals.totalPriceCents / 100,
      );
      element("pay-reference").textContent = state.booking.bookingId;
      element("pay-expiry").dateTime = state.booking.expiresAt;
      element("pay-expiry").textContent = hour.format(
        new Date(state.booking.expiresAt),
      );
    }
    element("pay-cash").disabled = state.busy;
    element("tickets-section").hidden = !state.sheet;
    renderTickets(state);
  },
};

const controller = createCounterController({
  api: createCounterApi({
    client: createApiClient(),
    fetchImpl: window.fetch.bind(window),
  }),
  view,
  newId: () => window.crypto.randomUUID(),
});

element("search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  controller.search({
    origin: form.origin.value,
    destination: form.destination.value,
    date: form.date.value,
  });
});
element("day-previous").addEventListener("click", () => controller.previousDay());
element("day-next").addEventListener("click", () => controller.nextDay());
element("day-today").addEventListener("click", () => controller.showDay(null));
element("day-date").addEventListener("change", (event) => {
  if (event.target.value) controller.showDay(event.target.value);
});
element("trip-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-index]");
  if (button) controller.chooseTrip(Number(button.dataset.index));
});
element("seat-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-seat-id]");
  if (button) controller.toggleSeat(button.dataset.seatId);
});
element("refresh-seats").addEventListener("click", () => controller.refreshSeats());
element("passenger-form").addEventListener("submit", (event) => {
  event.preventDefault();
  controller.review(readPassengers());
});
element("edit-sale").addEventListener("click", () => controller.edit());
element("confirm-sale").addEventListener("click", () => controller.confirm());
element("pay-cash").addEventListener("click", () => controller.pay());
element("print-tickets").addEventListener("click", () => window.print());
element("new-sale").addEventListener("click", () => {
  element("passenger-list").replaceChildren();
  controller.reset();
});

controller.start();
