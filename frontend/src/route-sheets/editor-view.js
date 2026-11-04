import {
  POLICY,
  pointsOf,
  localTime,
  programmingBody,
} from "./editor-model.js";
import { cyclePeriod, periodLabel } from "./lifecycle-model.js";
const POLICY_LABELS = [
  "Recargo VIP (%)",
  "Descuento menor de 18 años (%)",
  "Descuento desde 65 años (%)",
  "Descuento por discapacidad acreditada (%)",
];
const labelFrequency = (f) =>
  `${f.origin} → ${f.destination} · ${f.departureTime}${f.status === "INACTIVE" ? " (inactiva)" : ""}`;
const nice = (value) => localTime(value).replace("T", " ").slice(0, 19);
export function createEditorView(document, actions) {
  const find = (selector) => document.querySelector(selector);
  let sequence = 0,
    last;
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  function button(label, onClick, className = "btn btn-outline-dark") {
    const b = node("button", label, className);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }
  function field(
    parent,
    label,
    value,
    type,
    update,
    { readonly = false, required = true, name, min, step } = {},
  ) {
    const wrapper = node("div", undefined, "editor-field");
    const id = `editor-input-${++sequence}`;
    const input = node("input");
    input.type = type;
    input.id = id;
    input.className = "form-control";
    input.value = value ?? "";
    input.required = required;
    input.readOnly = readonly;
    if (name) input.dataset.field = name;
    if (min !== undefined) input.min = String(min);
    if (step !== undefined) input.step = String(step);
    if (type === "datetime-local") input.step = "0.001";
    if (type === "text") input.autocomplete = "off";
    const l = node("label", label, "form-label");
    l.htmlFor = id;
    if (update) input.addEventListener("input", () => update(input.value));
    wrapper.append(l, input);
    parent.append(wrapper);
    return input;
  }
  function select(
    parent,
    label,
    options,
    value,
    update,
    { readonly = false, name } = {},
  ) {
    const wrapper = node("div", undefined, "editor-field");
    const id = `editor-input-${++sequence}`;
    const input = node("select");
    input.id = id;
    input.className = "form-select";
    for (const [key, text] of options) {
      const option = node("option", text);
      option.value = key;
      input.append(option);
    }
    input.value = value || "";
    input.disabled = readonly;
    if (readonly) input.dataset.fixed = "true";
    if (name) input.dataset.field = name;
    const l = node("label", label, "form-label");
    l.htmlFor = id;
    if (update) input.addEventListener("change", () => update(input.value));
    wrapper.append(l, input);
    parent.append(wrapper);
    return input;
  }
  function renderProgram(state) {
    const root = find("#program-fields-content");
    root.replaceChildren();
    const { context, models } = state;
    const model = models.programming;
    const frequency = (id) => context.frequencies.find((f) => f.id === id);
    const edit = (fn, redraw = false) =>
      actions.edit("programming", fn, redraw);
    const period = node("div", undefined, "editor-grid");
    field(
      period,
      "Inicio del ciclo (fecha de la hoja)",
      model.cycleStartDate,
      "date",
      null,
      { readonly: true },
    );
    field(
      period,
      "Duración del ciclo en días (obligatoria)",
      model.cycleLengthDays,
      "number",
      (v) =>
        edit((m) => {
          m.cycleLengthDays = v;
        }),
      { min: 1, step: 1, name: "cycleLengthDays" },
    );
    root.append(period, node("h3", "Servicios requeridos"));
    if (!model.requiredServices.length)
      root.append(
        node(
          "p",
          "Añade cada salida que debe cubrir el grupo. No se deducen servicios ni duración a partir del número de buses.",
          "editor-note",
        ),
      );
    model.requiredServices.forEach((service) => {
      const card = node("section", undefined, "editor-item required-service");
      card.dataset.serviceId = service.id;
      const fields = node("div", undefined, "editor-grid");
      const active = context.frequencies
        .filter((f) => f.status === "ACTIVE" || f.id === service.frequencyId)
        .map((f) => [f.id, labelFrequency(f)]);
      const change = (key, value) =>
        edit((m) => {
          const s = m.requiredServices.find((s) => s.id === service.id);
          if (
            s.locked ||
            m.agendas.some((a) =>
              a.activities.some((a) => a.requiredServiceId === s.id),
            )
          )
            throw new Error(
              "Retira primero sus asignaciones y crea un servicio nuevo para cambiar frecuencia o salida.",
            );
          s[key] = value;
        }, true);
      select(
        fields,
        "Frecuencia",
        active,
        service.frequencyId,
        (v) => change("frequencyId", v),
        { readonly: service.locked, name: "serviceFrequency" },
      );
      field(
        fields,
        "Día de salida",
        service.date,
        "date",
        (v) => change("date", v),
        { readonly: service.locked, name: "serviceDate" },
      );
      card.append(
        fields,
        node(
          "p",
          `Salida autorizada: ${frequency(service.frequencyId).departureTime}. ${service.locked ? "Para cambiar una salida guardada, retírala y crea un servicio nuevo." : "La fecha puede incluir un cambio de día dentro del ciclo."}`,
          "editor-note",
        ),
        button("Retirar servicio requerido", () =>
          actions.removeService(service.id),
        ),
      );
      root.append(card);
    });
    const newService = node("div", undefined, "editor-actions");
    const chosen = select(
      newService,
      "Frecuencia para añadir",
      [
        ["", "Selecciona una frecuencia activa"],
        ...context.frequencies
          .filter((f) => f.status === "ACTIVE")
          .map((f) => [f.id, labelFrequency(f)]),
      ],
      "",
      null,
      { name: "newFrequency" },
    );
    newService.append(
      button("Añadir servicio requerido", () => actions.required(chosen.value)),
    );
    root.append(newService);
    root.append(node("h3", "Agendas de buses"));
    if (!context.buses.length)
      root.append(
        node(
          "p",
          "Este grupo no tiene buses registrados. Registra un bus antes de guardar su agenda.",
          "editor-note",
        ),
      );
    const busOptions = context.buses.map((b) => [
      b.id,
      `Unidad ${b.unitNumber} · ${b.plate}`,
    ]);
    model.agendas.forEach((agenda, index) => {
      const card = node("section", undefined, "editor-item bus-agenda");
      card.dataset.agenda = String(index);
      card.append(node("h4", `Agenda ${index + 1}`));
      const fields = node("div", undefined, "editor-grid");
      select(
        fields,
        "Bus del grupo",
        busOptions,
        agenda.busId,
        (v) =>
          edit((m) => {
            if (m.agendas.some((a, i) => i !== index && a.busId === v))
              throw new Error("Ese bus ya tiene una agenda en la hoja.");
            m.agendas[index].busId = v;
          }, true),
        { name: "busId" },
      );
      field(
        fields,
        "Disponible desde (fecha y hora)",
        agenda.initialAvailability.availableAt,
        "datetime-local",
        (v) =>
          edit((m) => {
            m.agendas[index].initialAvailability.availableAt = v;
          }),
        { name: "availableAt" },
      );
      field(
        fields,
        "Ubicación inicial",
        agenda.initialAvailability.locationKey,
        "text",
        (v) =>
          edit((m) => {
            m.agendas[index].initialAvailability.locationKey = v;
          }),
        { name: "initialLocation" },
      );
      card.append(fields);
      agenda.activities.forEach((activity, activityIndex) => {
        const item = node("section", undefined, "editor-activity");
        item.dataset.activity = String(activityIndex);
        item.dataset.kind = activity.kind;
        const mutate = (fn) =>
          edit((m) => fn(m.agendas[index].activities[activityIndex]));
        item.append(
          node(
            "h5",
            activity.kind === "SERVICE"
              ? `Servicio: ${labelFrequency(frequency(activity.frequencyId))}`
              : "Traslado sin pasajeros",
          ),
        );
        const times = node("div", undefined, "editor-grid");
        if (activity.kind === "TRANSFER") {
          field(
            times,
            "Lugar de origen del traslado",
            activity.originKey,
            "text",
            (v) =>
              mutate((a) => {
                a.originKey = v;
              }),
            { name: "transferOrigin" },
          );
          field(
            times,
            "Lugar de destino del traslado",
            activity.destinationKey,
            "text",
            (v) =>
              mutate((a) => {
                a.destinationKey = v;
              }),
            { name: "transferDestination" },
          );
        }
        field(
          times,
          "Salida (fecha y hora)",
          activity.departureAt,
          "datetime-local",
          (v) =>
            mutate((a) => {
              a.departureAt = v;
            }),
          { readonly: activity.kind === "SERVICE", name: "departureAt" },
        );
        field(
          times,
          "Llegada final (fecha y hora)",
          activity.arrivalAt,
          "datetime-local",
          (v) =>
            mutate((a) => {
              a.arrivalAt = v;
              if (a.kind === "SERVICE") a.points.at(-1).arrivalAt = v;
            }),
          { name: "arrivalAt" },
        );
        field(
          times,
          "Preparación posterior en minutos (cero es válido)",
          activity.preparationMinutes,
          "number",
          (v) =>
            mutate((a) => {
              a.preparationMinutes = v;
            }),
          { min: 0, step: 1, name: "preparationMinutes" },
        );
        item.append(times);
        if (activity.kind === "SERVICE") {
          const places = pointsOf(frequency(activity.frequencyId));
          item.append(
            node(
              "p",
              `Recorrido: ${places.join(" → ")}. Los extremos usan la salida y llegada indicadas arriba.`,
              "editor-note",
            ),
          );
          activity.points.slice(1, -1).forEach((point) => {
            const stop = node("div", undefined, "editor-grid");
            field(
              stop,
              `Llegada a ${places[point.position]}`,
              point.arrivalAt,
              "datetime-local",
              (v) =>
                mutate((a) => {
                  a.points[point.position].arrivalAt = v;
                }),
              { name: `point-${point.position}-arrivalAt` },
            );
            field(
              stop,
              `Salida de ${places[point.position]}`,
              point.departureAt,
              "datetime-local",
              (v) =>
                mutate((a) => {
                  a.points[point.position].departureAt = v;
                }),
              { name: `point-${point.position}-departureAt` },
            );
            item.append(stop);
          });
        }
        item.append(
          button("Retirar actividad", () =>
            edit(
              (m) => m.agendas[index].activities.splice(activityIndex, 1),
              true,
            ),
          ),
        );
        card.append(item);
      });
      const add = node("div", undefined, "editor-actions");
      const available = model.requiredServices.filter(
        (s) =>
          !model.agendas.some((a) =>
            a.activities.some((v) => v.requiredServiceId === s.id),
          ),
      );
      const service = select(
        add,
        "Servicio requerido para asignar",
        [
          ["", "Selecciona un servicio"],
          ...available.map((s) => [
            s.id,
            `${labelFrequency(frequency(s.frequencyId))} · ${s.date}`,
          ]),
        ],
        "",
        null,
        { name: "serviceToAssign" },
      );
      add.append(
        button("Asignar servicio al bus", () =>
          actions.activity(index, "SERVICE", service.value),
        ),
        button("Añadir traslado", () => actions.activity(index, "TRANSFER")),
      );
      card.append(add);
      card.append(node("h5", "Descanso y mantenimiento"));
      agenda.blocks.forEach((block, blockIndex) => {
        const row = node("section", undefined, "editor-activity");
        row.dataset.block = String(blockIndex);
        const mutate = (key, value) =>
          edit((m) => {
            m.agendas[index].blocks[blockIndex][key] = value;
          });
        const fields = node("div", undefined, "editor-grid");
        select(
          fields,
          "Tipo de bloqueo",
          [
            ["REST", "Descanso"],
            ["MAINTENANCE", "Mantenimiento"],
          ],
          block.kind,
          (v) => mutate("kind", v),
          { name: "blockKind" },
        );
        field(
          fields,
          "Inicio del bloqueo",
          block.startAt,
          "datetime-local",
          (v) => mutate("startAt", v),
          { name: "blockStart" },
        );
        field(
          fields,
          "Fin del bloqueo",
          block.endAt,
          "datetime-local",
          (v) => mutate("endAt", v),
          { name: "blockEnd" },
        );
        field(
          fields,
          "Motivo del bloqueo",
          block.reason,
          "text",
          (v) => mutate("reason", v),
          { name: "blockReason" },
        );
        row.append(
          fields,
          button("Retirar bloqueo", () =>
            edit((m) => m.agendas[index].blocks.splice(blockIndex, 1), true),
          ),
        );
        card.append(row);
      });
      card.append(
        button("Añadir descanso o mantenimiento", () => actions.block(index)),
        node(
          "p",
          "Descanso y mantenimiento impiden usar el bus durante el intervalo; no lo convierten en respaldo disponible.",
          "editor-note",
        ),
        button("Retirar agenda y sus actividades", () =>
          edit((m) => m.agendas.splice(index, 1), true),
        ),
      );
      root.append(card);
    });
    const newAgenda = node("div", undefined, "editor-actions");
    const bus = select(
      newAgenda,
      "Bus para añadir a la programación",
      [
        ["", "Selecciona un bus"],
        ...busOptions.filter(
          ([id]) => !model.agendas.some((a) => a.busId === id),
        ),
      ],
      "",
      null,
      { name: "newBus" },
    );
    newAgenda.append(
      button("Añadir agenda de bus", () => actions.agenda(bus.value)),
    );
    root.append(newAgenda);
  }
  function renderTariff(state) {
    const root = find("#tariff-fields-content");
    root.replaceChildren();
    const model = state.models.tariff;
    const fields = node("div", undefined, "editor-grid");
    POLICY.forEach((key, index) => {
      const input = field(
        fields,
        POLICY_LABELS[index],
        model.policy[key],
        "text",
        (v) =>
          actions.edit("tariff", (m) => {
            m.policy[key] = v;
          }),
        { name: key },
      );
      input.inputMode = "decimal";
      input.pattern = "[0-9]+([.,][0-9]{1,2})?";
    });
    root.append(fields);
    if (!model.frequencies.length)
      root.append(
        node(
          "p",
          "Guarda primero una programación para configurar todas sus combinaciones de viaje.",
          "editor-note",
        ),
      );
    model.frequencies.forEach((frequency, frequencyIndex) => {
      const card = node("section", undefined, "editor-item");
      card.append(node("h3", frequency.routePoints.join(" → ")));
      const grid = node("div", undefined, "editor-grid");
      frequency.prices.forEach((price, priceIndex) => {
        const input = field(
          grid,
          `${frequency.routePoints[price.fromPosition]} → ${frequency.routePoints[price.toPosition]} (USD)`,
          price.amount,
          "text",
          (v) =>
            actions.edit("tariff", (m) => {
              m.frequencies[frequencyIndex].prices[priceIndex].amount = v;
            }),
          {
            name: `price-${frequencyIndex}-${price.fromPosition}-${price.toPosition}`,
          },
        );
        input.inputMode = "decimal";
        input.pattern = "[0-9]+([.,][0-9]{1,2})?";
      });
      card.append(grid);
      root.append(card);
    });
  }
  function renderReview(state, root = find("#review-content")) {
    root.replaceChildren();
    const review = state.review;
    if (!review) return;
    if (["publish", "renew"].includes(review.kind)) {
      root.append(
        node(
          "p",
          `${state.context.sheet.busGroupName}. ${periodLabel(review.period)}.`,
        ),
      );
      root.append(
        node(
          "p",
          review.kind === "publish"
            ? "Confirmar publica esta programación y congela sus tarifas e inventario comercial. No podrás editar la hoja publicada."
            : "Confirmar prepara el siguiente borrador contiguo con programación desplazada y copia editable de tarifas. El servidor decide su admisibilidad. No publica viajes ni cambia ventas o reservas anteriores.",
        ),
      );
      root.append(
        node(
          "p",
          `Programación revisada: ${review.body.expectedProgrammingRevision}. Tarifario revisado: ${review.body.expectedRevision ?? review.body.expectedTariffRevision}.`,
        ),
      );
      const programming = node("div"),
        tariff = node("div");
      root.append(
        node(
          "h3",
          review.kind === "renew"
            ? "Patrón guardado de origen que se copiará"
            : "Programación guardada",
        ),
        programming,
        node("h3", "Precios y porcentajes guardados"),
        tariff,
      );
      renderReview(
        {
          ...state,
          review: {
            kind: "programming",
            summaryOnly: true,
            body: programmingBody(state.models.programming, state.context),
          },
        },
        programming,
      );
      renderReview(
        {
          ...state,
          review: {
            kind: "tariff",
            body: {
              policy: state.context.tariff.tariff.policy,
              frequencies: state.context.tariff.tariff.frequencies,
            },
          },
        },
        tariff,
      );
      return;
    }
    if (review.kind === "reload") {
      root.append(
        node(
          "p",
          "Se descartarán los cambios locales de programación y tarifas para cargar la versión guardada.",
        ),
      );
      return;
    }
    const body = review.body;
    if (review.kind === "programming") {
      const p = body.programming;
      root.append(
        node(
          "p",
          `Ciclo desde ${p.cycleStartDate}, ${p.cycleLengthDays} día(s). ${review.summaryOnly ? "Patrón guardado que estás revisando." : "Se reemplazará la programación completa, incluidas las retiradas que hiciste."}`,
        ),
      );
      if (state.context.sheet.hasLegacyAssignments && !review.summaryOnly)
        root.append(
          node(
            "p",
            "Este guardado sustituirá las asignaciones y días de parada antiguos por la programación revisada.",
            "editor-warning",
          ),
        );
      const list = node("ul");
      for (const agenda of p.agendas) {
        const bus = state.context.buses.find((b) => b.id === agenda.busId);
        const item = node(
          "li",
          `Unidad ${bus.unitNumber} · ${bus.plate}. Disponible ${nice(agenda.initialAvailability.availableAt)} en ${agenda.initialAvailability.locationKey}.`,
        );
        const activityList = node("ul");
        for (const activity of agenda.activities) {
          const route =
            activity.kind === "SERVICE"
              ? labelFrequency(
                  state.context.frequencies.find(
                    (f) => f.id === activity.frequencyId,
                  ),
                )
              : `${activity.originKey} → ${activity.destinationKey} (traslado)`;
          const entry = node(
            "li",
            `${route}: ${nice(activity.departureAt)} a ${nice(activity.arrivalAt)}, preparación ${activity.preparationMinutes} min.`,
          );
          if (activity.kind === "SERVICE") {
            const names = pointsOf(
              state.context.frequencies.find(
                (f) => f.id === activity.frequencyId,
              ),
            );
            const stops = node("ul");
            for (const point of activity.points.slice(1, -1))
              stops.append(
                node(
                  "li",
                  `${names[point.position]}: llegada ${nice(point.arrivalAt)}, salida ${nice(point.departureAt)}.`,
                ),
              );
            entry.append(stops);
          }
          activityList.append(entry);
        }
        for (const b of agenda.blocks)
          activityList.append(
            node(
              "li",
              `${b.kind === "REST" ? "Descanso" : "Mantenimiento"}: ${nice(b.startAt)} a ${nice(b.endAt)}. ${b.reason}`,
            ),
          );
        item.append(activityList);
        list.append(item);
      }
      root.append(list);
    } else {
      root.append(
        node(
          "p",
          "Precios explícitos por combinación y porcentajes de la hoja. Un guardado de tarifas por separado no publica viajes.",
        ),
      );
      const list = node("ul");
      POLICY.forEach((key, i) =>
        list.append(
          node(
            "li",
            `${POLICY_LABELS[i]}: ${(body.policy[key] / 100).toFixed(2)} %`,
          ),
        ),
      );
      for (const f of body.frequencies) {
        const names = pointsOf(
          state.context.frequencies.find((value) => value.id === f.frequencyId),
        );
        for (const p of f.prices)
          list.append(
            node(
              "li",
              `${names[p.fromPosition]} → ${names[p.toPosition]}: USD ${(p.amountCents / 100).toFixed(2)}`,
            ),
          );
      }
      root.append(list);
    }
  }
  function touch(state) {
    last = state;
    find("#editor-status-panel").dataset.mode = state.mode;
    find("#editor-status").textContent = state.message;
    find("#editor-content").setAttribute("aria-busy", String(state.busy));
    const disabled =
      !state.context ||
      state.context.sheet.status !== "DRAFT" ||
      state.busy ||
      state.blocked ||
      state.conflict ||
      !!state.uncertain ||
      !!state.review;
    find("#program-fields").disabled = disabled;
    find("#tariff-fields").disabled = disabled || state.dirty.programming;
    find("#program-review").disabled = disabled || !state.dirty.programming;
    find("#tariff-review").disabled =
      disabled ||
      state.dirty.programming ||
      !state.models?.tariff.frequencies.length ||
      !state.dirty.tariff;
    find("#program-dirty").textContent = state.dirty.programming
      ? "Cambios locales sin guardar"
      : "Sin cambios locales";
    find("#tariff-dirty").textContent = state.dirty.tariff
      ? "Cambios locales sin guardar"
      : "Sin cambios locales";
    find("#editor-reload").disabled =
      state.busy || state.blocked || !!state.uncertain;
    find("#editor-check").hidden = !state.uncertain;
    find("#editor-check").disabled = state.busy || state.blocked;
    find("#editor-check").textContent =
      state.uncertain?.kind === "renew"
        ? "Recuperar la misma renovación"
        : state.uncertain?.kind === "publish"
          ? "Comprobar publicación"
          : "Comprobar guardado";
    const lifecycleDisabled =
      !state.context ||
      state.busy ||
      state.blocked ||
      state.conflict ||
      !!state.uncertain ||
      !!state.review ||
      Object.values(state.dirty).some(Boolean) ||
      !state.context.programming.revision ||
      !state.context.tariff.revision;
    const published = state.context?.sheet.status === "PUBLISHED";
    find("#sheet-publish").hidden = published;
    find("#sheet-publish").disabled = lifecycleDisabled || published;
    find("#sheet-renew").hidden = !published;
    find("#sheet-renew").disabled =
      lifecycleDisabled || !published || !!state.destination;
    find("#renewal-destination").hidden =
      !state.destination || state.blocked || !!state.uncertain;
    if (state.destination)
      find("#renewal-destination").href =
        `/pages/programar-hoja.html?id=${encodeURIComponent(state.destination.id)}`;
    else find("#renewal-destination").removeAttribute("href");
    find("#review-confirm").disabled = state.busy || state.blocked;
    find("#review-cancel").disabled = state.busy || state.blocked;
    find("#editor-login").hidden = state.mode !== "signed-out";
    find("#editor-restart").hidden = !state.blocked;
  }
  find("#editor-reload").addEventListener("click", () => actions.reload());
  find("#editor-check").addEventListener("click", () => actions.reconcile());
  find("#review-cancel").addEventListener("click", () => actions.cancel());
  find("#review-confirm").addEventListener("click", () => actions.confirm());
  find("#sheet-publish").addEventListener("click", () =>
    actions.lifecycle("publish"),
  );
  find("#sheet-renew").addEventListener("click", () =>
    actions.lifecycle("renew"),
  );
  return {
    touch,
    render(state) {
      last = state;
      find("#editor-content").hidden = !state.context;
      find("#editor-review-panel").hidden = !state.review;
      if (state.context) {
        const { sheet } = state.context;
        find("#editor-heading").textContent =
          `${sheet.busGroupName} · ${sheet.routeDate}`;
        find("#editor-state").textContent =
          sheet.status === "DRAFT"
            ? "Borrador: los cambios no habilitan ventas."
            : "Publicada: solo lectura. No puedes alterar su historia.";
        let period = "Guarda primero una programación y sus tarifas completas.";
        try {
          period = `${sheet.status === "PUBLISHED" ? "Siguiente período previsto" : "Período que se publicará"}: ${periodLabel(cyclePeriod(state.context, sheet.status === "PUBLISHED"))}.`;
        } catch {
          /* Borrador todavía incompleto. */
        }
        find("#lifecycle-help").textContent = period;
        find("#program-version").textContent = String(
          state.context.programming.revision,
        );
        find("#tariff-version").textContent = String(
          state.context.tariff.revision,
        );
        renderProgram(state);
        renderTariff(state);
      } else {
        find("#editor-heading").textContent = "";
        find("#program-fields-content").replaceChildren();
        find("#tariff-fields-content").replaceChildren();
        find("#lifecycle-help").textContent = "";
      }
      renderReview(state);
      touch(state);
      if (state.mode === "review") find("#review-title").focus();
      else if (
        [
          "invalid",
          "error",
          "conflict",
          "rejected",
          "uncertain",
          "success",
          "forbidden",
          "session-changed",
        ].includes(state.mode)
      )
        find("#editor-status").focus();
    },
    hasUnsaved: () =>
      last && (last.dirty.programming || last.dirty.tariff || !!last.uncertain),
  };
}
