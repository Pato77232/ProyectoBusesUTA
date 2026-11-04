import { isUuid } from "./contracts.js";
import {
  makeIntent,
  sameSource,
  verifyRenewal,
  createOperationStore,
} from "./lifecycle-model.js";

export function createLifecycleActions({
  state,
  client,
  sheetId,
  view,
  fetchContext,
  verify,
  getActor,
  install,
  show,
  accessError,
  newId,
  store = createOperationStore(),
}) {
  const root = `/api/v1/route-sheets/${sheetId}`;
  const isLifecycle = (intent) => ["publish", "renew"].includes(intent?.kind);
  function restore() {
    try {
      const pending = store.read(getActor(), sheetId);
      if (pending) {
        state.uncertain = pending;
        show(
          "uncertain",
          "Hay una operación pendiente de comprobar en esta pestaña. Recupera su resultado antes de continuar.",
        );
        return true;
      }
    } catch (error) {
      state.blocked = true;
      show(
        "error",
        error.message ||
          "No se pudo consultar la operación pendiente. No se enviarán cambios.",
      );
      return true;
    }
    return false;
  }
  function review(kind) {
    if (
      state.busy ||
      state.blocked ||
      state.conflict ||
      state.uncertain ||
      state.review ||
      !state.context
    )
      return;
    if (Object.values(state.dirty).some(Boolean)) {
      show(
        "invalid",
        "Guarda o descarta tus cambios locales antes de publicar o preparar otro ciclo.",
      );
      return;
    }
    try {
      state.review = makeIntent(kind, state.context, getActor(), newId);
      show(
        "review",
        kind === "publish"
          ? "Revisa la programación y los precios guardados. Publicar habilita los viajes válidos para venta."
          : "Revisa el siguiente período. Preparar crea un borrador; no publica ni amplía ventas.",
      );
    } catch (error) {
      show("invalid", error.message);
    }
  }
  function finish() {
    store.remove(getActor(), sheetId);
    state.uncertain = null;
    state.review = null;
  }
  async function post(path, data) {
    try {
      return await client.request(path, { method: "POST", data });
    } catch (error) {
      // Un fallo de la consulta posterior no prueba que el POST haya sido rechazado.
      error.operationRejected = [400, 403, 404, 409, 422].includes(
        error?.status,
      );
      throw error;
    }
  }
  async function checkPublication(intent) {
    const context = await fetchContext();
    if (!context) return;
    if (!sameSource(context, intent)) {
      finish();
      install(context);
      state.conflict = true;
      show(
        "conflict",
        "La hoja tiene otra versión. Se cargó el estado actual; recarga y revisa antes de iniciar una nueva operación.",
      );
      return;
    }
    finish();
    install(context);
    show(
      context.sheet.status === "PUBLISHED" ? "success" : "ready",
      context.sheet.status === "PUBLISHED"
        ? "Publicación verificada. La hoja quedó en solo lectura y sus viajes están sujetos a las reglas de venta."
        : "La hoja continúa en borrador. No se repitió la publicación; revisa y confirma otra vez si deseas publicarla.",
    );
  }
  async function sendRenewal(intent) {
    // El mismo cuerpo y clave recuperan el resultado durable; nunca una intención nueva.
    const result = await post(root + "/renewals", intent.body);
    if (!(await verify())) return;
    if (!isUuid(result?.renewal?.routeSheetId))
      throw new Error("Respuesta de renovación no verificable.");
    const target = await fetchContext(result.renewal.routeSheetId);
    if (!target) return;
    const destination = verifyRenewal(result, intent, target);
    const source = await fetchContext();
    if (!source) return;
    if (!sameSource(source, intent) || source.sheet.status !== "PUBLISHED")
      throw new Error("Origen no verificable.");
    finish();
    install(source);
    state.destination = destination;
    show(
      "success",
      destination.status === "DRAFT"
        ? "Renovación preparada y verificada. Abre el borrador para revisarlo; todavía no habilita ventas."
        : "Renovación recuperada: la hoja de destino ya está publicada. Abre su programación para consultarla.",
    );
  }
  function handleError(error, intent, sent) {
    state.review = null;
    if (sent) state.uncertain = intent;
    if (accessError(error)) return;
    if (sent && error.operationRejected) {
      finish();
      state.conflict = error.status === 409;
      show(
        state.conflict ? "conflict" : "rejected",
        `${error.message || "El servidor rechazó la operación."} No se confirmó una nueva operación. Recarga para revisar el estado actual.`,
      );
    } else if (sent)
      show(
        "uncertain",
        intent.kind === "renew"
          ? "No se pudo verificar la renovación. Recupera el resultado con la misma solicitud; no prepares otro ciclo ni cambies de pestaña."
          : "No se pudo verificar la publicación. Comprueba el estado actual; no se reenviará el POST.",
      );
    else
      show(
        "error",
        error.message ||
          "No se pudo comprobar la hoja. No se envió la operación.",
      );
  }
  async function confirm() {
    const intent = state.review;
    if (!isLifecycle(intent) || state.busy || state.blocked || state.uncertain)
      return;
    let sent = false;
    state.busy = true;
    show(
      "saving",
      "Comprobando sesión, programación y tarifas antes de continuar…",
    );
    try {
      const context = await fetchContext();
      if (!context) return;
      if (
        !sameSource(context, intent) ||
        context.sheet.status !==
          (intent.kind === "publish" ? "DRAFT" : "PUBLISHED")
      ) {
        state.review = null;
        state.conflict = true;
        show(
          "conflict",
          "La hoja cambió después de la revisión. No se envió la operación. Recarga y revisa las versiones actuales.",
        );
        return;
      }
      store.write(getActor(), sheetId, intent);
      state.uncertain = intent;
      state.review = null;
      sent = true;
      if (intent.kind === "renew") await sendRenewal(intent);
      else {
        await post(root + "/publish", intent.body);
        if (await verify()) await checkPublication(intent);
      }
    } catch (error) {
      handleError(error, intent, sent);
    } finally {
      state.busy = false;
      view.touch(state);
    }
  }
  async function reconcile() {
    const intent = state.uncertain;
    if (!isLifecycle(intent) || state.busy || state.blocked) return;
    state.busy = true;
    show(
      "checking",
      intent.kind === "renew"
        ? "Recuperando la misma renovación, sin crear una solicitud nueva…"
        : "Consultando publicación sin repetir el envío…",
    );
    try {
      if (!(await verify())) return;
      if (intent.kind === "renew") await sendRenewal(intent);
      else await checkPublication(intent);
    } catch (error) {
      handleError(error, intent, true);
    } finally {
      state.busy = false;
      view.touch(state);
    }
  }
  return { review, confirm, reconcile, restore, isLifecycle };
}
