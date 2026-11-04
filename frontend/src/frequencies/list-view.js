const label = (status) => (status === "ACTIVE" ? "Activa" : "Inactiva");
const money = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
});
export function createFrequencyListView(
  document,
  { onSelect, onChange, onCancel, onConfirm, onRetry },
) {
  const find = (selector) => document.querySelector(selector);
  let last = { busy: true, rows: [] };
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function updateDisabled() {
    const locked =
      last.busy ||
      last.blocked ||
      !!last.uncertain ||
      last.mode === "signed-out";
    find("#filters-fields").disabled = locked;
    find("#results").setAttribute("aria-busy", String(last.busy));
    for (const button of find("#frequency-rows").querySelectorAll("button"))
      button.disabled = locked;
    find("#change-state").disabled = locked || !last.selected || !!last.pending;
    find("#confirm-change").disabled = locked || !last.pending;
    find("#cancel-change").disabled = last.busy || last.blocked;
    find("#retry").disabled = last.busy || last.blocked;
  }
  find("#change-state").addEventListener("click", onChange);
  find("#cancel-change").addEventListener("click", onCancel);
  find("#confirm-change").addEventListener("click", onConfirm);
  find("#retry").addEventListener("click", onRetry);
  function details(row) {
    const content = find("#frequency-detail");
    content.replaceChildren();
    if (!row) return;
    const list = element("dl");
    for (const [key, value] of [
      ["Origen", row.origin],
      ["Destino", row.destination],
      ["Hora de salida", row.departure_time],
      ["Resolución ANT", row.ant_resolution_number],
      ["Estado", label(row.status)],
      ["Identificador", row.id],
    ])
      list.append(element("dt", key), element("dd", value));
    content.append(list, element("h3", "Recorrido autorizado"));
    const points = [row.origin, ...row.stops, row.destination];
    const route = element("ol");
    for (const point of points) route.append(element("li", point));
    content.append(
      route,
      element("h3", "Valores registrados por tramo"),
      element(
        "p",
        "Estos valores pertenecen al registro de la frecuencia. La tarifa comercial de venta se configura en la hoja de ruta.",
        "frequency-note",
      ),
    );
    const prices = element("ul");
    row.segment_prices.forEach((price, index) =>
      prices.append(
        element(
          "li",
          `${points[index]} → ${points[index + 1]}: ${money.format(price)}`,
        ),
      ),
    );
    content.append(prices);
  }
  return {
    setBusy(busy) {
      last.busy = busy;
      updateDisabled();
    },
    render(state) {
      last = { ...state };
      find("#status-panel").dataset.mode = state.mode;
      find("#status").textContent = state.message;
      find("#retry").hidden =
        !state.uncertain &&
        !["error", "rejected", "signed-out"].includes(state.mode);
      find("#retry").textContent = state.uncertain
        ? "Comprobar estado actual"
        : "Volver a consultar";
      find("#login-link").hidden = state.mode !== "signed-out";
      find("#reload-link").hidden = !state.blocked;
      const body = find("#frequency-rows");
      body.replaceChildren();
      for (const row of state.rows) {
        const tr = element("tr");
        for (const value of [
          row.origin,
          row.destination,
          row.departure_time,
          label(row.status),
        ])
          tr.append(element("td", value));
        const action = element("td");
        const button = element("button", "Ver detalle", "btn btn-outline-dark");
        button.type = "button";
        button.dataset.id = row.id;
        button.setAttribute(
          "aria-label",
          `Ver detalle: ${row.origin} a ${row.destination}, ${row.departure_time}`,
        );
        button.addEventListener("click", () => onSelect(row.id));
        action.append(button);
        tr.append(action);
        body.append(tr);
      }
      find("#frequency-table").hidden = state.rows.length === 0;
      find("#detail-panel").hidden = !state.selected;
      details(state.selected);
      find("#change-state").textContent =
        state.selected?.status === "ACTIVE"
          ? "Desactivar frecuencia"
          : "Activar frecuencia";
      find("#confirmation").hidden = !state.pending;
      if (state.pending) {
        const { original, target } = state.pending;
        find("#confirmation-text").textContent =
          `${original.origin} → ${original.destination}, ${original.departure_time}: cambiar de ${label(original.status).toLowerCase()} a ${label(target).toLowerCase()}.`;
        find("#confirmation-warning").textContent =
          target === "INACTIVE"
            ? "El servidor impedirá desactivar si hay ciclos, servicios o pasajeros afectados. Esta acción no cancela viajes ni compras."
            : "La frecuencia quedará activa. Activarla no publica viajes ni amplía ciclos de venta.";
      }
      updateDisabled();
      if (["detail", "success"].includes(state.mode))
        find("#detail-title").focus();
      else if (state.mode === "confirm") find("#confirmation-title").focus();
      else if (
        [
          "invalid",
          "error",
          "rejected",
          "uncertain",
          "forbidden",
          "session-changed",
        ].includes(state.mode)
      )
        find("#status").focus();
    },
  };
}
