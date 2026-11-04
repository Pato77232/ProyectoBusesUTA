import { isUuid, readFilters, readGroups, readSheets } from "./contracts.js";
import { readDraftRequest, readCreatedDraft } from "./draft-contracts.js";

export function createRouteSheetListController({ client, view, draftView }) {
  let busy = false;
  let actor = null;
  let blocked = false;
  let available = false;
  let groups = [];
  let draft = {
    mode: "checking",
    message: "Comprueba tu sesión para crear un borrador.",
  };
  function renderDraft() {
    draftView?.render({
      ...draft,
      groups,
      locked:
        busy ||
        blocked ||
        !available ||
        !groups.length ||
        !["ready", "invalid", "rejected"].includes(draft.mode),
    });
  }
  function show(mode, message, extra = {}) {
    view.render({ mode, message, rows: [], groups: [], ...extra });
    if (["signed-out", "forbidden", "session-changed"].includes(mode)) {
      available = false;
      groups = [];
      draftView?.reset();
      draft = { mode, message };
      renderDraft();
    }
  }
  async function verify() {
    const { user } = await client.request("/api/v1/auth/me");
    if (!user || !isUuid(user.id) || typeof user.role !== "string")
      throw new Error("Sesión no verificable.");
    if (user.role !== "COOPERATIVE_ADMIN") {
      blocked = true;
      show(
        "forbidden",
        "Necesitas una sesión de administrador de cooperativa para consultar hojas de ruta.",
      );
      return false;
    }
    if (!isUuid(user.cooperative_id))
      throw new Error("Cooperativa no verificable.");
    if (
      actor &&
      (actor.id !== user.id || actor.cooperative_id !== user.cooperative_id)
    ) {
      blocked = true;
      show(
        "session-changed",
        "La sesión cambió. Recarga la página para consultar con la identidad actual.",
      );
      return false;
    }
    actor = { id: user.id, cooperative_id: user.cooperative_id };
    return true;
  }
  async function load(input = {}) {
    if (busy || blocked) return;
    let filters;
    try {
      filters = readFilters(input);
    } catch (error) {
      show("invalid", error.message);
      return;
    }
    busy = true;
    available = false;
    renderDraft();
    show("loading", "Comprobando sesión y consultando hojas de ruta…", {
      filters,
    });
    try {
      if (!(await verify())) return;
      groups = readGroups(await client.request("/api/v1/bus-groups"));
      if (!(await verify())) return;
      if (
        filters.busGroupId &&
        !groups.some((group) => group.id === filters.busGroupId)
      ) {
        show(
          "invalid",
          "El grupo seleccionado ya no está disponible. Vuelve a seleccionarlo.",
          { groups, filters },
        );
        return;
      }
      const query = new URLSearchParams(filters).toString();
      const response = await client.request(
        `/api/v1/route-sheets${query ? `?${query}` : ""}`,
      );
      if (!(await verify())) return;
      const rows = readSheets(response, actor.cooperative_id, groups, filters);
      available = true;
      if (["checking", "check-error", "signed-out"].includes(draft.mode))
        draft = {
          mode: "ready",
          message: groups.length
            ? "Selecciona grupo y fecha para crear un borrador."
            : "Tu cooperativa necesita un grupo de buses para crear una hoja.",
        };
      show(
        rows.length ? "ready" : "empty",
        rows.length
          ? `${rows.length} hoja(s) encontrada(s).`
          : groups.length
            ? "No hay hojas de ruta para los filtros seleccionados."
            : "Tu cooperativa todavía no tiene grupos de buses ni hojas de ruta.",
        { rows, groups, filters },
      );
    } catch (error) {
      if (error?.status === 401)
        show(
          "signed-out",
          "Tu sesión venció o no está disponible. Inicia sesión y vuelve a consultar.",
        );
      else if (error?.status === 403) {
        blocked = true;
        show(
          "forbidden",
          "No tienes permiso para consultar estas hojas de ruta.",
        );
      } else
        show(
          "error",
          "No pudimos verificar la consulta. Comprueba la conexión y vuelve a consultar.",
        );
    } finally {
      busy = false;
      renderDraft();
    }
  }
  async function createDraft(input) {
    if (
      busy ||
      blocked ||
      !available ||
      !groups.length ||
      !["ready", "invalid", "rejected"].includes(draft.mode)
    )
      return;
    let request;
    try {
      request = readDraftRequest(input);
    } catch (error) {
      draft = { mode: "invalid", message: error.message };
      renderDraft();
      return;
    }
    busy = true;
    let started = false;
    let confirmed = false;
    draft = {
      mode: "saving",
      message: "Comprobando sesión y creando borrador…",
    };
    view.setBusy?.(true);
    renderDraft();
    try {
      if (!(await verify())) return;
      groups = readGroups(await client.request("/api/v1/bus-groups"));
      if (!(await verify())) return;
      if (!groups.some((group) => group.id === request.busGroupId)) {
        draft = {
          mode: "invalid",
          message:
            "El grupo seleccionado ya no está disponible. Selecciona otro grupo.",
        };
        return;
      }
      started = true;
      const response = await client.request("/api/v1/route-sheets", {
        method: "POST",
        data: request,
      });
      const created = readCreatedDraft(response, request, actor);
      if (!(await verify())) {
        draft = {
          mode: "uncertain",
          message:
            "La sesión cambió después del envío. No se puede mostrar la respuesta; inicia sesión y comprueba el listado antes de volver a intentarlo.",
        };
        return;
      }
      draft = {
        mode: "success",
        message:
          "Borrador creado. Todavía no tiene programación ni viajes publicados.",
        created,
      };
      confirmed = true;
    } catch (error) {
      if (
        error?.status === 401 ||
        (error?.status === 403 && error?.code !== "CSRF_TOKEN_INVALID")
      ) {
        show(
          error.status === 401 ? "signed-out" : "forbidden",
          "No se puede continuar con esta sesión. Vuelve a iniciar sesión y comprueba el listado antes de enviar otra solicitud.",
        );
      } else if (
        started &&
        ([400, 409, 429].includes(error?.status) ||
          error?.code === "CSRF_TOKEN_INVALID")
      ) {
        draft = {
          mode: "rejected",
          message:
            error.code === "ROUTE_SHEET_ALREADY_EXISTS_FOR_DATE_AND_GROUP"
              ? "Ya existe una hoja para ese grupo y fecha. Consúltala en el listado; no se creó otra."
              : error.code === "CSRF_TOKEN_INVALID"
                ? "La protección de la solicitud venció. Puedes volver a enviarla."
                : "No se aceptó el borrador. Revisa los datos e inténtalo de nuevo.",
        };
      } else if (started) {
        draft = {
          mode: "uncertain",
          message:
            "No pudimos confirmar el resultado. El borrador podría haberse creado. Consulta el listado por grupo y fecha antes de recargar la página y volver a crear; este envío no se repetirá automáticamente.",
        };
      } else {
        available = false;
        draft = {
          mode: "check-error",
          message:
            "No pudimos comprobar tu sesión o los grupos. Vuelve a consultar las hojas antes de crear.",
        };
      }
    } finally {
      busy = false;
      view.setBusy?.(false);
      renderDraft();
    }
    if (confirmed) {
      view.resetFilters?.();
      await load();
    }
  }
  async function startAnother() {
    if (busy || blocked || draft.mode !== "success") return;
    busy = true;
    view.setBusy?.(true);
    renderDraft();
    try {
      if (!(await verify())) return;
      groups = readGroups(await client.request("/api/v1/bus-groups"));
      if (!(await verify())) return;
      draftView?.reset();
      draft = {
        mode: "ready",
        message: groups.length
          ? "Completa los datos del nuevo borrador."
          : "Tu cooperativa necesita un grupo de buses para crear una hoja.",
      };
      available = true;
    } catch (error) {
      available = false;
      if (error?.status === 401 || error?.status === 403)
        show(
          error.status === 401 ? "signed-out" : "forbidden",
          "La sesión no está disponible. Vuelve a iniciar sesión.",
        );
      else
        draft = {
          mode: "check-error",
          message:
            "No pudimos comprobar la sesión o los grupos. Vuelve a consultar las hojas.",
        };
    } finally {
      busy = false;
      view.setBusy?.(false);
      renderDraft();
    }
  }
  return { load, createDraft, startAnother };
}
