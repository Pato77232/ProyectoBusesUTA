const PHOTO_BASE = "/api/v1/buses";

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createBusInventoryView(
  root = document.querySelector("#bus-inventory"),
) {
  const statusNode = document.querySelector("#inventory-status");
  const retryNode = document.querySelector("#inventory-retry");
  const titleNode = document.querySelector("#inventory-title");

  function clear() {
    root.replaceChildren();
  }

  function status(message, tone = "info", retry = false) {
    statusNode.textContent = message;
    statusNode.dataset.tone = tone;
    statusNode.hidden = false;
    retryNode.hidden = !retry;
    retryNode.onclick = retry ? () => globalThis.location.reload() : null;
  }

  function showList(buses) {
    clear();
    titleNode.textContent = "Buses de tu cooperativa";
    statusNode.hidden = true;
    retryNode.hidden = true;
    if (buses.length === 0) {
      status("Todavía no hay buses registrados en tu cooperativa.", "info");
      return;
    }
    const list = makeElement("div", "row g-3");
    for (const bus of buses) {
      const column = makeElement("div", "col-12 col-md-6");
      const card = makeElement("article", "card h-100");
      const body = makeElement("div", "card-body");
      const heading = makeElement(
        "h2",
        "h5 card-title",
        `Unidad ${bus.unitNumber}`,
      );
      const plate = makeElement("p", "mb-2", `Placa: ${bus.plate}`);
      const group = makeElement("p", "mb-2", `Grupo: ${bus.busGroupName}`);
      const capacity = makeElement(
        "p",
        "mb-3",
        `Capacidad ofrecida: ${bus.capacity}`,
      );
      const photos = makeElement("p", "mb-3", `Fotografías: ${bus.photoCount}`);
      const link = makeElement(
        "a",
        "btn btn-outline-dark",
        "Ver detalle del bus",
      );
      link.href = `/pages/buses.html?id=${encodeURIComponent(bus.id)}`;
      link.setAttribute(
        "aria-label",
        `Ver detalle de la unidad ${bus.unitNumber}, ${bus.plate}`,
      );
      body.append(heading, plate, group, capacity, photos, link);
      card.append(body);
      column.append(card);
      list.append(column);
    }
    root.append(list);
  }

  function addValue(container, label, value) {
    const item = makeElement("div", "col-12 col-sm-6");
    item.append(
      makeElement("dt", "fw-semibold", label),
      makeElement("dd", "mb-2", String(value)),
    );
    container.append(item);
  }

  function showDetails(bus) {
    clear();
    titleNode.textContent = `Detalle del bus · unidad ${bus.unitNumber}`;
    statusNode.hidden = true;
    retryNode.hidden = true;
    const back = makeElement(
      "a",
      "btn btn-link px-0 mb-3",
      "Volver al inventario de buses",
    );
    back.href = "/pages/buses.html";
    const summary = makeElement("dl", "row");
    addValue(summary, "Placa", bus.plate);
    addValue(summary, "Chasis", bus.vin);
    addValue(summary, "Número de unidad", bus.unitNumber);
    addValue(summary, "Marca de carrocería", bus.bodyworkBrand);
    addValue(summary, "Color", bus.color);
    addValue(summary, "Grupo", bus.busGroup.name);
    addValue(summary, "Capacidad ofrecida", bus.capacity);
    addValue(
      summary,
      "Plantilla",
      `${bus.seatLayout.id}, versión ${bus.seatLayout.version}`,
    );
    root.append(back, makeElement("h2", "h4 mt-3", "Datos del bus"), summary);

    const photosTitle = makeElement("h2", "h4 mt-4", "Fotografías");
    const photos = makeElement("div", "row g-3");
    if (bus.photos.length === 0)
      photos.append(makeElement("p", "", "No hay fotografías disponibles."));
    for (const [index, photo] of bus.photos.entries()) {
      const column = makeElement("div", "col-12 col-sm-6 col-lg-4");
      const image = makeElement("img", "img-fluid rounded border");
      image.src = `${PHOTO_BASE}/${encodeURIComponent(bus.id)}/photos/${encodeURIComponent(photo.id)}`;
      image.alt = `Fotografía ${index + 1} del bus unidad ${bus.unitNumber}`;
      image.loading = "lazy";
      column.append(image);
      photos.append(column);
    }
    root.append(photosTitle, photos);

    const seatsTitle = makeElement(
      "h2",
      "h4 mt-4",
      "Configuración de asientos",
    );
    const seatTable = makeElement("div", "table-responsive");
    const table = makeElement("table", "table table-striped align-middle");
    const head = makeElement("thead");
    const header = makeElement("tr");
    for (const label of ["Asiento", "Piso", "Categoría", "Oferta"])
      header.append(makeElement("th", "", label));
    head.append(header);
    const body = makeElement("tbody");
    for (const seat of bus.seats) {
      const row = makeElement("tr");
      row.append(
        makeElement("th", "", `Asiento ${seat.label}`),
        makeElement("td", "", String(seat.deck)),
        makeElement(
          "td",
          "",
          seat.category === "ACCESSIBLE" ? "Accesible" : seat.category,
        ),
        makeElement("td", "", seat.offered ? "Ofrecido" : "No ofrecido"),
      );
      body.append(row);
    }
    table.append(head, body);
    seatTable.append(table);
    root.append(seatsTitle, seatTable);
  }

  return {
    loading: (message) => status(message, "info"),
    signedOut: (message) => {
      status(message, "error");
      root.replaceChildren(makeElement("a", "btn btn-dark", "Iniciar sesión"));
      root.firstElementChild.href = "/pages/login.html";
    },
    blocked: (message) => status(message, "error"),
    notFound: (message) => {
      status(message, "error");
      const link = makeElement(
        "a",
        "btn btn-dark mt-2",
        "Volver al inventario",
      );
      link.href = "/pages/buses.html";
      root.replaceChildren(link);
    },
    failed: (message) => status(message, "error", true),
    showList,
    showDetails,
  };
}

export { createBusInventoryView };
