import { createApiClient } from "../api/api-client.js";
import { createHistoryController } from "./history-controller.js";
const el = (id) => document.getElementById(id);
const states = {
  PENDING_PAYMENT: "Pendiente de pago",
  SOLD: "Vendida",
  EXPIRED: "Vencida",
  REJECTED: "Rechazada",
};
const date = (value) =>
  new Intl.DateTimeFormat("es-EC", {
    timeZone: "America/Guayaquil",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
const money = (value) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(
    value / 100,
  );
function node(tag, text) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
}
const controller = createHistoryController({
  api: createApiClient(),
  render(state) {
    el("history-status").textContent = state.message;
    el("history-login").hidden = !state.login;
    el("history-refresh").disabled = state.busy;
    el("history-next").disabled = state.busy;
    el("history-next").hidden = !state.cursor;
    el("history-list").setAttribute("aria-busy", String(state.busy));
    el("history-list").replaceChildren();
    for (const item of state.items) {
      const li = node("li"),
        button = node(
          "button",
          states[item.status] +
            " · " +
            date(item.createdAt) +
            " · " +
            money(item.summary.totals.totalPriceCents),
        );
      button.type = "button";
      button.className = "btn btn-outline-dark mb-3 text-break";
      button.disabled = state.busy;
      button.addEventListener("click", async () => {
        await controller.open(item.bookingId);
        el("history-detail").focus();
      });
      li.append(button);
      el("history-list").append(li);
    }
    const panel = el("history-detail");
    panel.replaceChildren();
    panel.hidden = !state.detail;
    if (state.detail) {
      const b = state.detail;
      panel.append(
        node("h2", "Reserva " + b.bookingId),
        node("p", "Estado: " + states[b.status]),
        node("p", "Total: " + money(b.summary.totals.totalPriceCents)),
      );
      if (b.expiresAt)
        panel.append(node("p", "Plazo registrado: " + date(b.expiresAt)));
      for (const p of b.summary.passengers)
        panel.append(node("p", p.fullName + " · asiento " + p.seatId));
      if (b.status === "SOLD") {
        const link = node("a", "Ver mis boletos");
        link.href =
          "boletos.html?" + new URLSearchParams({ reserva: b.bookingId });
        panel.append(link);
      } else if (b.status === "PENDING_PAYMENT")
        panel.append(
          node(
            "p",
            "Esta consulta no amplía el plazo de pago ni modifica la reserva.",
          ),
        );
    }
  },
});
el("history-refresh").addEventListener("click", () => controller.load());
el("history-next").addEventListener("click", () => controller.load(true));
window.addEventListener("pagehide", () => controller.forget());
window.addEventListener("pageshow", (event) => {
  if (event.persisted) controller.load();
});
controller.load();
