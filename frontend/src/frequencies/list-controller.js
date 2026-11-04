import {
  isUuid,
  readFilters,
  readFrequency,
  readList,
  matches,
  sameFrequency,
} from "./list-contracts.js";
const ROOT = "/api/v1/frequencies";
export function createFrequencyListController({ client, view }) {
  let actor,
    busy = false,
    blocked = false,
    rows = [],
    selected = null,
    filters = {},
    pending = null,
    uncertain = null;
  function show(mode, message) {
    view.render({
      mode,
      message,
      rows,
      selected,
      pending,
      uncertain,
      busy,
      blocked,
    });
  }
  function clear() {
    rows = [];
    selected = null;
    pending = null;
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
      blocked = true;
      clear();
      show(
        "forbidden",
        "Necesitas una sesión de administrador de cooperativa.",
      );
      return false;
    }
    if (!isUuid(user.cooperative_id)) throw new Error("Sesión no verificable.");
    if (
      actor &&
      (actor.id !== user.id || actor.cooperative_id !== user.cooperative_id)
    ) {
      blocked = true;
      clear();
      show(
        "session-changed",
        "La sesión cambió. Recarga la página antes de continuar.",
      );
      return false;
    }
    actor = { id: user.id, cooperative_id: user.cooperative_id };
    return true;
  }
  function failure(error) {
    clear();
    if (error?.status === 401)
      show(
        "signed-out",
        "Tu sesión venció. Inicia sesión y vuelve a consultar.",
      );
    else if (error?.status === 403) {
      blocked = true;
      show("forbidden", "No tienes permiso para realizar esta operación.");
    } else if (error?.status === 404)
      show(
        "error",
        "La frecuencia ya no está disponible. Vuelve a consultar el listado.",
      );
    else
      show(
        "error",
        "No pudimos verificar los datos. Comprueba la conexión y vuelve a consultar.",
      );
  }
  async function detail(id) {
    const response = await client.request(`${ROOT}/${id}`);
    if (!(await verify())) return null;
    return readFrequency(response?.frequency, actor.cooperative_id, id);
  }
  async function load(input = {}) {
    if (busy || blocked || uncertain) return;
    let query;
    try {
      query = readFilters(input);
    } catch (error) {
      show("invalid", error.message);
      return;
    }
    busy = true;
    clear();
    show("loading", "Comprobando sesión y consultando frecuencias…");
    try {
      if (!(await verify())) return;
      const search = new URLSearchParams(query).toString();
      const response = await client.request(
        ROOT + (search ? `?${search}` : ""),
      );
      if (!(await verify())) return;
      filters = query;
      rows = readList(response, actor.cooperative_id, filters);
      show(
        rows.length ? "ready" : "empty",
        rows.length
          ? `${rows.length} frecuencia(s) encontrada(s).`
          : "No hay frecuencias para los filtros seleccionados.",
      );
    } catch (error) {
      failure(error);
    } finally {
      busy = false;
      view.setBusy(false);
    }
  }
  async function select(id) {
    if (busy || blocked || uncertain || !rows.some((row) => row.id === id))
      return;
    busy = true;
    selected = null;
    pending = null;
    show("loading", "Consultando el detalle actual…");
    try {
      if (!(await verify())) return;
      selected = await detail(id);
      if (selected) {
        rows = rows
          .map((row) => (row.id === selected.id ? selected : row))
          .filter((row) => matches(row, filters));
        show(
          "detail",
          "Detalle verificado. El origen, destino y hora no se pueden modificar.",
        );
      }
    } catch (error) {
      failure(error);
    } finally {
      busy = false;
      view.setBusy(false);
    }
  }
  function beginChange() {
    if (busy || blocked || uncertain || !selected) return;
    pending = Object.freeze({
      original: selected,
      target: selected.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
    });
    show("confirm", "Revisa el cambio antes de confirmarlo.");
  }
  function cancel() {
    if (busy || !pending) return;
    pending = null;
    show("detail", "Cambio cancelado. No se envió ninguna modificación.");
  }
  async function confirm() {
    if (busy || blocked || uncertain || !pending) return;
    const intent = pending;
    let sent = false,
      received = false;
    busy = true;
    show("saving", "Verificando el estado antes de guardar…");
    try {
      if (!(await verify())) return;
      const current = await detail(intent.original.id);
      if (!current) return;
      selected = current;
      rows = rows
        .map((row) => (row.id === current.id ? current : row))
        .filter((row) => matches(row, filters));
      if (!sameFrequency(current, intent.original)) {
        pending = null;
        show(
          "detail",
          "La frecuencia cambió desde tu consulta. Revisa el detalle antes de iniciar otro cambio.",
        );
        return;
      }
      if (!(await verify())) return;
      sent = true;
      const response = await client.request(`${ROOT}/${current.id}/status`, {
        method: "PATCH",
        data: { status: intent.target },
      });
      received = true;
      uncertain = intent;
      if (!(await verify())) return;
      const saved = readFrequency(
        response?.frequency,
        actor.cooperative_id,
        current.id,
      );
      if (
        saved.status !== intent.target ||
        !sameFrequency(saved, current, { status: false })
      )
        throw new Error("Respuesta no verificable.");
      selected = saved;
      pending = null;
      uncertain = null;
      rows = rows
        .map((row) => (row.id === saved.id ? saved : row))
        .filter((row) => matches(row, filters));
      show("success", "Estado actualizado y confirmado por el servidor.");
    } catch (error) {
      pending = null;
      if (error?.status === 401 || error?.status === 403) failure(error);
      else if (
        sent &&
        !received &&
        (error?.status === 409 ||
          (error?.status === 503 &&
            error.code === "FREQUENCY_COMMITMENTS_UNAVAILABLE") ||
          error?.status === 400 ||
          error?.status === 404)
      ) {
        uncertain = null;
        selected = null;
        rows = [];
        show(
          "rejected",
          error.code === "FREQUENCY_HAS_COMMITMENTS"
            ? "No se puede desactivar: hay ciclos, servicios o pasajeros afectados. Espera al cierre de sus obligaciones y vuelve a consultar."
            : error.code === "FREQUENCY_COMMITMENTS_UNAVAILABLE"
              ? "No se pudieron comprobar los compromisos. La frecuencia no se ha desactivado. Vuelve a consultar antes de intentarlo."
              : "El servidor rechazó el cambio. Vuelve a consultar la frecuencia.",
        );
      } else if (sent) {
        uncertain = intent;
        selected = null;
        rows = [];
        show(
          "uncertain",
          "No se pudo confirmar el resultado del cambio. Comprueba el estado actual antes de realizar otra modificación.",
        );
      } else failure(error);
    } finally {
      busy = false;
      view.setBusy(false);
    }
  }
  async function reconcile() {
    if (busy || blocked || !uncertain) return;
    const intent = uncertain;
    busy = true;
    show("checking", "Consultando el estado actual, sin reenviar el cambio…");
    try {
      if (!(await verify())) return;
      selected = await detail(intent.original.id);
      if (!selected) return;
      uncertain = null;
      pending = null;
      rows = [];
      show(
        "detail",
        "Estado actual verificado. No se ha reenviado la operación. Puedes revisar una nueva modificación.",
      );
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) failure(error);
      else
        show(
          "uncertain",
          "Todavía no pudimos verificar el estado actual. No vuelvas a enviar el cambio; comprueba la conexión e inténtalo de nuevo.",
        );
    } finally {
      busy = false;
      view.setBusy(false);
    }
  }
  return { load, select, beginChange, cancel, confirm, reconcile };
}
