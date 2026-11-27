import { createApiClient } from "../api/api-client.js";
import { tripAction } from "./customer-dashboard.js";
import { createDashboardController } from "./dashboard-controller.js";

const element = (id) => document.getElementById(id);
const usd = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
});
const when = new Intl.DateTimeFormat("es-EC", {
  timeZone: "America/Guayaquil",
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
});

function node(tag, text, className) {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  if (className) result.className = className;
  return result;
}

function tripCard(trip) {
  const item = node("li", undefined, "dashboard-trip");
  const action = tripAction(trip);
  const link = node("a", action.label, "btn btn-outline-dark btn-sm");
  link.href = action.href;
  const passengers =
    trip.passengers === 1 ? "1 pasajero" : trip.passengers + " pasajeros";
  item.append(
    node("h3", trip.origin + " → " + trip.destination, "h5 mb-1"),
    node("p", when.format(new Date(trip.departureAt)), "mb-1"),
    node(
      "p",
      trip.statusLabel +
        " · " +
        passengers +
        " · " +
        usd.format(trip.totalPriceCents / 100),
      "dashboard-trip-meta mb-2",
    ),
    link,
  );
  item.dataset.status = trip.status;
  return item;
}

function fill(listId, emptyId, trips) {
  element(listId).replaceChildren(...trips.map(tripCard));
  element(emptyId).hidden = trips.length > 0;
}

function show(message, tone = "info") {
  const status = element("dashboard-status");
  status.textContent = message;
  status.dataset.tone = tone;
  status.hidden = false;
}

const controller = createDashboardController({
  client: createApiClient(),
  view: {
    loading(message) {
      element("dashboard-content").setAttribute("aria-busy", "true");
      show(message);
    },
    greet(email) {
      element("dashboard-email").textContent = email;
    },
    trips({ upcoming, recent }) {
      fill("upcoming-trips", "upcoming-empty", upcoming);
      fill("recent-trips", "recent-empty", recent);
      element("dashboard-content").setAttribute("aria-busy", "false");
      element("dashboard-content").hidden = false;
      element("dashboard-status").hidden = true;
    },
    signedOut(message) {
      show(message, "error");
      element("dashboard-content").hidden = true;
      element("dashboard-login").hidden = false;
    },
    failed(message) {
      show(message, "error");
    },
    leave(href) {
      window.location.assign(href);
    },
  },
});

element("dashboard-logout").addEventListener("click", () =>
  controller.logout(),
);
controller.start();
