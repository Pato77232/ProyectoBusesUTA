import { isUuid } from "./contracts.js";
import { createLifecycleActions } from "./lifecycle-actions.js";
import {
  readEditor,
  programModel,
  tariffModel,
  programmingBody,
  tariffBody,
  canonical,
  addRequired,
  removeRequired,
  addActivity,
} from "./editor-model.js";
export function createEditorController({
  client,
  sheetId,
  view,
  newId = () => globalThis.crypto.randomUUID(),
  operationStore,
}) {
  const state = {
    mode: "loading",
    message: "Comprobando sesión y cargando la hoja…",
    context: null,
    models: null,
    dirty: { programming: false, tariff: false },
    busy: false,
    blocked: false,
    conflict: false,
    review: null,
    uncertain: null,
    destination: null,
  };
  let actor;
  const root = `/api/v1/route-sheets/${sheetId}`;
  const show = (mode, message) => {
    state.mode = mode;
    state.message = message;
    view.render(state);
  };
  function clear() {
    state.context = null;
    state.models = null;
    state.review = null;
    state.destination = null;
  }
  async function verify() {
    const { user } = await client.request("/api/v1/auth/me");
    if (
      !user ||
      !isUuid(user.id) ||
      !["COOPERATIVE_ADMIN", "SYSTEM_ADMIN", "CLERK", "CUSTOMER"].includes(
        user.role,
      )
    )
      throw new Error("Sesión no verificable.");
    if (user.role !== "COOPERATIVE_ADMIN") {
      clear();
      state.blocked = true;
      show(
        "forbidden",
        "Necesitas una sesión de administrador de cooperativa.",
      );
      return false;
    }
    if (!isUuid(user.cooperative_id))
      throw new Error("Cooperativa no verificable.");
    if (
      actor &&
      (actor.id !== user.id || actor.cooperative_id !== user.cooperative_id)
    ) {
      clear();
      state.blocked = true;
      show(
        "session-changed",
        "La sesión cambió. Recarga esta página antes de continuar.",
      );
      return false;
    }
    actor = { id: user.id, cooperative_id: user.cooperative_id };
    return true;
  }
  async function fetchContext(id = sheetId) {
    if (!(await verify())) return null;
    const result = await client.request(`/api/v1/route-sheets/${id}/editor`);
    if (!(await verify())) return null;
    return readEditor(result, id, actor.cooperative_id);
  }
  function accessError(error) {
    if (error?.status === 401) {
      clear();
      show(
        "signed-out",
        "Tu sesión venció. Inicia sesión antes de volver a consultar.",
      );
      return true;
    }
    if (error?.status === 403 && error.code !== "CSRF_TOKEN_INVALID") {
      clear();
      state.blocked = true;
      show("forbidden", "No tienes permiso para editar esta hoja.");
      return true;
    }
    return false;
  }
  function install(context) {
    state.destination = null;
    state.context = context;
    state.models = {
      programming: programModel(context),
      tariff: tariffModel(context),
    };
    state.dirty = { programming: false, tariff: false };
    state.review = null;
    state.conflict = false;
    state.uncertain = null;
  }
  async function load() {
    if (state.busy || state.blocked || state.uncertain) return;
    if (!isUuid(sheetId)) {
      show("error", "Selecciona una hoja válida desde el listado.");
      return;
    }
    state.busy = true;
    clear();
    show("loading", "Consultando hoja, programación, buses y tarifas…");
    try {
      const context = await fetchContext();
      if (!context) return;
      install(context);
      if (lifecycle.restore()) return;
      show(
        "ready",
        context.sheet.status === "DRAFT"
          ? "Borrador cargado. Programación y tarifas se guardan por separado."
          : "Hoja publicada: consulta en solo lectura.",
      );
    } catch (error) {
      clear();
      if (!accessError(error))
        show(
          "error",
          error?.status === 404
            ? "La hoja no existe o no pertenece a tu cooperativa."
            : "No pudimos verificar la hoja y sus catálogos. Vuelve a consultar.",
        );
    } finally {
      state.busy = false;
      view.touch(state);
    }
  }
  function editable() {
    return (
      state.context?.sheet.status === "DRAFT" &&
      !state.busy &&
      !state.blocked &&
      !state.conflict &&
      !state.uncertain &&
      !state.review
    );
  }
  function edit(kind, change, redraw = false) {
    if (!editable()) return;
    try {
      change(state.models[kind]);
      state.dirty[kind] = true;
      state.mode = "editing";
      state.message =
        "Tienes cambios locales sin guardar. Revisa y confirma cada apartado.";
      if (redraw) view.render(state);
      else view.touch(state);
    } catch (error) {
      show("invalid", error.message);
    }
  }
  function required(frequencyId) {
    edit(
      "programming",
      (m) => addRequired(m, state.context, frequencyId, newId),
      true,
    );
  }
  function removeService(serviceId) {
    edit("programming", (m) => removeRequired(m, serviceId), true);
  }
  function agenda(busId) {
    edit(
      "programming",
      (m) => {
        if (
          !state.context.buses.some((b) => b.id === busId) ||
          m.agendas.some((a) => a.busId === busId)
        )
          throw new Error(
            "Selecciona un bus disponible del grupo que todavía no tenga agenda.",
          );
        m.agendas.push({
          busId,
          initialAvailability: { availableAt: "", locationKey: "" },
          activities: [],
          blocks: [],
        });
      },
      true,
    );
  }
  function activity(index, kind, serviceId) {
    edit(
      "programming",
      (m) => addActivity(m, state.context, index, kind, serviceId, newId),
      true,
    );
  }
  function block(index) {
    edit(
      "programming",
      (m) =>
        m.agendas[index].blocks.push({
          id: newId(),
          kind: "REST",
          startAt: "",
          endAt: "",
          reason: "",
        }),
      true,
    );
  }
  const bodyFor = (kind, context = state.context, models = state.models) =>
    kind === "programming"
      ? programmingBody(models.programming, context)
      : tariffBody(models.tariff, context);
  function review(kind) {
    if (!editable()) return;
    if (kind === "tariff" && state.dirty.programming) {
      show(
        "invalid",
        "Guarda primero la programación para configurar sus tarifas.",
      );
      return;
    }
    try {
      state.review = { kind, body: globalThis.structuredClone(bodyFor(kind)) };
      show("review", "Revisa el reemplazo antes de confirmar su guardado.");
    } catch (error) {
      show("invalid", error.message);
    }
  }
  function cancel() {
    if (state.busy) return;
    state.review = null;
    show("editing", "Guardado cancelado. Tus cambios locales siguen aquí.");
  }
  function reload() {
    if (state.busy || state.blocked || state.uncertain) return;
    if (Object.values(state.dirty).some(Boolean)) {
      state.review = { kind: "reload" };
      show(
        "review",
        "Recargar descartará tus cambios locales. Confirma solo si deseas recuperar la versión guardada.",
      );
    } else load();
  }
  function applyResult(kind, context) {
    if (kind === "programming") {
      const previous = state.models.tariff;
      const old = JSON.stringify(previous);
      state.context = { ...state.context, programming: context.programming };
      state.models.programming = programModel(state.context);
      state.dirty.programming = false;
      state.models.tariff = tariffModel(state.context, previous);
      state.dirty.tariff =
        state.dirty.tariff || JSON.stringify(state.models.tariff) !== old;
    } else {
      state.context = { ...state.context, tariff: context.tariff };
      state.models.tariff = tariffModel(state.context);
      state.dirty.tariff = false;
    }
    state.review = null;
    state.uncertain = null;
  }
  async function confirm() {
    if (lifecycle.isLifecycle(state.review)) return lifecycle.confirm();
    if (state.busy || state.blocked || !state.review || state.uncertain) return;
    if (state.review.kind === "reload") {
      state.review = null;
      state.conflict = false;
      state.dirty = { programming: false, tariff: false };
      await load();
      return;
    }
    const intent = state.review;
    let sent = false,
      received = false;
    state.busy = true;
    show("saving", "Revalidando sesión y versión guardada…");
    try {
      const fresh = await fetchContext();
      if (!fresh) return;
      if (
        fresh.sheet.status !== "DRAFT" ||
        fresh[intent.kind].revision !== intent.body.expectedRevision
      ) {
        state.review = null;
        state.conflict = true;
        show(
          "conflict",
          "La hoja fue publicada o cambió su versión. Conservamos tus campos locales; descarta y recarga para revisar la versión actual.",
        );
        return;
      }
      sent = true;
      const result = await client.request(
        root + (intent.kind === "programming" ? "/programming" : "/tariff"),
        { method: "PUT", data: intent.body },
      );
      received = true;
      state.uncertain = intent;
      if (!(await verify())) return;
      const record = intent.kind === "programming" ? result : result.tariff;
      const context = readEditor(
        { ...state.context, [intent.kind]: record },
        sheetId,
        actor.cooperative_id,
      );
      const models = {
        programming: programModel(context),
        tariff: tariffModel(context),
      };
      if (
        context[intent.kind].revision !== intent.body.expectedRevision + 1 ||
        canonical(bodyFor(intent.kind, context, models)) !==
          canonical(intent.body)
      )
        throw new Error("Guardado no verificable.");
      applyResult(intent.kind, context);
      show(
        "success",
        intent.kind === "programming"
          ? "Programación guardada y confirmada. Revisa sus tarifas por separado."
          : "Tarifario guardado y confirmado. La hoja sigue en borrador.",
      );
    } catch (error) {
      state.review = null;
      if (sent && received) state.uncertain = intent;
      if (!accessError(error)) {
        if (
          sent &&
          !received &&
          ([400, 409].includes(error?.status) ||
            error?.code === "CSRF_TOKEN_INVALID")
        ) {
          state.uncertain = null;
          state.conflict = /REVISION_CONFLICT|NOT_EDITABLE/.test(
            error.code || "",
          );
          show(
            state.conflict ? "conflict" : "rejected",
            `${error.message || "No se aceptaron los datos."} Tus campos locales se conservan. No se ha confirmado un nuevo guardado.`,
          );
        } else if (sent) {
          state.uncertain = intent;
          show(
            "uncertain",
            "El guardado podría haberse realizado. Consulta su estado actual antes de enviar otra modificación. No se reenviará automáticamente.",
          );
        } else
          show(
            "error",
            "No pudimos comprobar la versión. Tus cambios locales se conservan; vuelve a revisar antes de guardar.",
          );
      }
    } finally {
      state.busy = false;
      view.touch(state);
    }
  }
  async function reconcile() {
    if (lifecycle.isLifecycle(state.uncertain)) return lifecycle.reconcile();
    if (state.busy || state.blocked || !state.uncertain) return;
    const intent = state.uncertain;
    state.busy = true;
    show("checking", "Consultando la versión actual sin repetir el guardado…");
    try {
      const context = await fetchContext();
      if (!context) return;
      const models = {
        programming: programModel(context),
        tariff: tariffModel(context),
      };
      let matches = false;
      try {
        matches =
          canonical(bodyFor(intent.kind, context, models)) ===
          canonical(intent.body);
      } catch {
        /* Aún no existe un contenido completo guardado. */
      }
      if (!state.models) {
        install(context);
        show(
          matches ? "success" : "ready",
          matches
            ? "Se restableció la sesión y el contenido guardado coincide con el enviado."
            : "Se restableció la sesión y se cargó la versión guardada. No se repitió el envío; revisa la hoja antes de iniciar cambios.",
        );
        return;
      }
      state.uncertain = null;
      state.review = null;
      if (matches) {
        applyResult(intent.kind, context);
        if (context.sheet.status !== "DRAFT")
          state.context.sheet.status = context.sheet.status;
        show(
          "success",
          "El contenido guardado coincide con el enviado. Se verificó sin repetir la operación.",
        );
      } else if (
        context[intent.kind].revision === intent.body.expectedRevision &&
        context.sheet.status === "DRAFT"
      ) {
        show(
          "editing",
          "La versión actual no contiene esos cambios. Se conservan localmente; puedes volver a revisarlos antes de iniciar otro guardado.",
        );
      } else {
        state.conflict = true;
        show(
          "conflict",
          "Existe una versión distinta o la hoja fue publicada. Tus campos se conservan; descarta y recarga para revisar el contenido actual.",
        );
      }
    } catch (error) {
      if (!accessError(error))
        show(
          "uncertain",
          "No se pudo verificar el guardado. Conservamos tus cambios y no repetimos la operación.",
        );
    } finally {
      state.busy = false;
      view.touch(state);
    }
  }
  const lifecycle = createLifecycleActions({
    state,
    client,
    sheetId,
    view,
    fetchContext,
    verify,
    getActor: () => actor,
    install,
    show,
    accessError,
    newId,
    store: operationStore,
  });
  return {
    reviewLifecycle: lifecycle.review,
    load,
    reload,
    edit,
    required,
    removeService,
    agenda,
    activity,
    block,
    review,
    cancel,
    confirm,
    reconcile,
    hasUnsaved: () =>
      Object.values(state.dirty).some(Boolean) || !!state.uncertain,
  };
}
