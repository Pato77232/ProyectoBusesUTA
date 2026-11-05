export function createBenefitsView(doc) {
  const el = (id) => doc.getElementById(id);
  const node = (tag, text, className) => {
    const n = doc.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (className) n.className = className;
    return n;
  };
  const date = (value) =>
    new Intl.DateTimeFormat("es-EC", {
      timeZone: "America/Guayaquil",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  let key = null;
  function input(label, id, type = "text") {
    const box = node("div", undefined, "benefit-field");
    const caption = node("label", label);
    caption.htmlFor = id;
    const control = node("input");
    control.id = id;
    control.type = type;
    control.autocomplete = "off";
    if (type === "text") {
      control.pattern = "ref_[A-Za-z0-9_-]{4,124}";
      control.maxLength = 128;
      control.placeholder = "ref_documento_interno";
    }
    box.append(caption, control);
    return { box, control };
  }
  function detailPanel(detail) {
    el("benefit-fields").replaceChildren();
    el("benefit-context").replaceChildren();
    if (!detail) {
      el("benefit-detail").hidden = true;
      return;
    }
    el("benefit-detail").hidden = false;
    el("benefit-context").append(
      node("h2", detail.fromPlace + " → " + detail.toPlace),
      node("p", "Embarque: " + date(detail.expiresAt) + " · hora de Ecuador"),
    );
    const reviewing = detail.status === "PENDING";
    el("benefit-instructions").textContent = reviewing
      ? "Marca únicamente lo que hayas comprobado con el documento presentado. Una casilla sin marcar se registra como no acreditada."
      : detail.review
        ? "Consulta el resultado registrado. La revisión no se puede sobrescribir desde esta pantalla."
        : "El plazo terminó sin revisión registrada. Consulta nuevamente el viaje.";
    el("benefit-confirmation").hidden = !reviewing;
    el("save-benefits").hidden = !reviewing;
    el("confirmed-context").checked = false;
    for (const [index, passenger] of (detail.passengers || []).entries()) {
      const field = node("fieldset", undefined, "benefit-passenger");
      field.dataset.seatId = passenger.seatId;
      field.append(
        node("legend", passenger.fullName),
        node(
          "p",
          "Cédula: " +
            passenger.identificationNumber +
            " · Nacimiento: " +
            passenger.birthDate,
        ),
      );
      const decision = detail.review?.decisions.find(
        (d) => d.seatId === passenger.seatId,
      );
      if (!reviewing) {
        field.append(
          node(
            "p",
            decision
              ? "Fecha: " +
                  (decision.birthDateVerified
                    ? "verificada"
                    : "no acreditada") +
                  " · Discapacidad: " +
                  (decision.disabilityVerified ? "verificada" : "no acreditada")
              : "Plazo de revisión terminado.",
          ),
        );
        for (const evidence of decision?.evidence || [])
          field.append(
            node(
              "p",
              ({
                IDENTITY: "Documento de identidad",
                BIRTH_RECORD: "Registro de nacimiento",
                DISABILITY: "Acreditación de discapacidad",
              }[evidence.kind] || "Documento") +
                ": " +
                evidence.reference,
            ),
          );
      } else {
        for (const [prefix, label] of [
          ["birth", "Fecha de nacimiento verificada"],
          ["disability", "Discapacidad acreditada"],
        ]) {
          const check = input(label, prefix + "-" + index, "checkbox");
          check.control.dataset.check = prefix;
          field.append(check.box);
          if (prefix === "birth") {
            const caption = node("label", "Documento de edad");
            caption.htmlFor = "document-" + index;
            const select = node("select");
            select.id = caption.htmlFor;
            select.dataset.kind = "birth";
            for (const [value, text] of [
              ["IDENTITY", "Documento de identidad"],
              ["BIRTH_RECORD", "Registro de nacimiento"],
            ]) {
              const option = node("option", text);
              option.value = value;
              select.append(option);
            }
            const box = node("div", undefined, "benefit-field");
            box.append(caption, select);
            field.append(box);
          }
          const reference = input(
            "Referencia privada del documento " +
              (prefix === "birth" ? "de edad" : "de discapacidad"),
            prefix + "-reference-" + index,
          );
          reference.control.dataset.reference = prefix;
          reference.control.disabled = true;
          check.control.addEventListener("change", () => {
            reference.control.disabled = !check.control.checked;
            reference.control.required = check.control.checked;
            if (!check.control.checked) reference.control.value = "";
          });
          field.append(reference.box);
        }
      }
      el("benefit-fields").append(field);
    }
    if (detail.review)
      el("benefit-context").append(
        node("p", "Verificación registrada: " + date(detail.review.reviewedAt)),
      );
  }
  return {
    render(state) {
      el("benefit-status").textContent = state.message;
      el("benefit-workspace").setAttribute("aria-busy", String(state.busy));
      el("refresh-benefits").disabled = state.busy;
      el("next-benefits").disabled =
        state.busy || state.uncertain || !state.nextCursor;
      el("retry-benefits").hidden = !state.uncertain;
      el("retry-benefits").disabled = state.busy;
      const list = el("benefit-list");
      list.replaceChildren();
      for (const request of state.items) {
        const button = node("button", undefined, "benefit-item");
        button.type = "button";
        button.dataset.requestId = request.requestId;
        const status = {
          PENDING: "Por revisar",
          REVIEWED: "Revisada",
          EXPIRED: "Plazo terminado",
        }[request.status];
        button.append(
          node("strong", request.fromPlace + " → " + request.toPlace),
          node(
            "span",
            status + " · " + request.passengerCount + " pasajero(s)",
          ),
          node("small", "Embarque: " + date(request.expiresAt)),
        );
        button.disabled = state.busy || state.uncertain;
        list.append(button);
      }
      const nextKey = state.detail
        ? state.detail.requestId +
          ":" +
          state.detail.revision +
          ":" +
          state.detail.status
        : null;
      if (key !== nextKey) {
        key = nextKey;
        detailPanel(state.detail);
      }
      for (const control of el("benefit-form").querySelectorAll(
        "input,select,button",
      )) {
        const field = control.closest("[data-seat-id]");
        const ref = control.dataset.reference;
        control.disabled =
          state.busy ||
          state.uncertain ||
          (ref && !field.querySelector('[data-check="' + ref + '"]').checked);
      }
    },
    decisions() {
      return [...el("benefit-fields").querySelectorAll("[data-seat-id]")].map(
        (field) => {
          const birthDateVerified = field.querySelector(
            '[data-check="birth"]',
          ).checked;
          const disabilityVerified = field.querySelector(
            '[data-check="disability"]',
          ).checked;
          const evidence = [];
          if (birthDateVerified)
            evidence.push({
              kind: field.querySelector('[data-kind="birth"]').value,
              reference: field.querySelector('[data-reference="birth"]').value,
            });
          if (disabilityVerified)
            evidence.push({
              kind: "DISABILITY",
              reference: field.querySelector('[data-reference="disability"]')
                .value,
            });
          return {
            seatId: field.dataset.seatId,
            birthDateVerified,
            disabilityVerified,
            evidence,
          };
        },
      );
    },
  };
}
