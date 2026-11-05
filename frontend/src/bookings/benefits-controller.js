import { ApiError } from "../api/api-error.js";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const copy = (value) => JSON.parse(JSON.stringify(value));
function guardedApi(source, generation) {
  return Object.fromEntries(
    Object.entries(source).map(([key, operation]) => [
      key,
      async (...args) => {
        const before = generation();
        const ensureCurrent = () => {
          if (before !== generation())
            throw new ApiError("REQUEST_ABORTED", "La vista privada se cerró.");
        };
        let result;
        try {
          result = await operation(...args);
        } catch (error) {
          ensureCurrent();
          throw error;
        }
        ensureCurrent();
        return result;
      },
    ]),
  );
}
export function readBenefitRequest(value) {
  if (
    !value ||
    !UUID.test(value.requestId) ||
    !["PENDING", "REVIEWED", "EXPIRED"].includes(value.status) ||
    ![1, 2].includes(value.revision) ||
    !Number.isFinite(Date.parse(value.expiresAt)) ||
    typeof value.fromPlace !== "string" ||
    typeof value.toPlace !== "string"
  )
    throw new ApiError(
      "RESPONSE_INVALID",
      "No pudimos leer la solicitud. Vuelve a consultar.",
    );
  return copy(value);
}
export function benefitMessage(error) {
  if (error.code === "UNAUTHENTICATED")
    return "Tu sesión terminó. Inicia sesión para continuar.";
  if (error.code === "FORBIDDEN")
    return "Necesitas una sesión de oficinista de esta cooperativa.";
  if (error.code === "BOOKING_BENEFIT_REVIEW_CONFLICT")
    return "La solicitud ya cambió. Recarga el detalle antes de continuar.";
  if (error.code === "BOOKING_TRIP_UNAVAILABLE")
    return "El viaje ya no admite esta revisión. Vuelve a consultar el viaje.";
  if (error.code === "BOOKING_BENEFIT_REQUEST_NOT_FOUND")
    return "La solicitud no está disponible para esta sesión.";
  if (error.code === "BOOKING_BENEFIT_REQUEST_INVALID")
    return "Revisa las verificaciones y las referencias de los documentos.";
  if (error.code === "CSRF_TOKEN_INVALID")
    return "La protección del formulario cambió. Vuelve a intentar.";
  return "No pudimos completar la consulta. Puedes volver a intentarlo.";
}
export function createBenefitsController({ api, render }) {
  let epoch = 0;
  api = guardedApi(api, () => epoch);
  let identity = null,
    pending = null;
  let state = {
    busy: false,
    items: [],
    detail: null,
    nextCursor: null,
    message: "",
    uncertain: false,
  };
  const emit = (patch) => {
    state = { ...state, ...patch };
    render(copy(state));
  };
  function clear() {
    pending = null;
    emit({ items: [], detail: null, nextCursor: null, uncertain: false });
  }
  async function authorize() {
    const { user } = await api.session();
    if (user?.role !== "CLERK" || !user.id || !user.cooperative_id)
      throw new ApiError("FORBIDDEN", "Acceso de oficinista requerido.", 403);
    const key = JSON.stringify([user.id, user.cooperative_id]);
    const changed = identity !== null && identity !== key;
    if (identity !== key) clear();
    identity = key;
    return !changed;
  }
  async function action(work) {
    if (state.busy) return;
    emit({ busy: true, message: "Consultando…" });
    try {
      await work();
    } catch (error) {
      if (error.code === "REQUEST_ABORTED") return;
      if (["UNAUTHENTICATED", "FORBIDDEN"].includes(error.code)) {
        identity = null;
        clear();
      }
      emit({ message: benefitMessage(error) });
    } finally {
      emit({ busy: false });
    }
  }
  async function sendPending() {
    try {
      const result = readBenefitRequest(
        (await api.review(pending.id, copy(pending.command))).request,
      );
      if (
        result.requestId !== pending.id ||
        result.revision !== 2 ||
        !result.review
      )
        throw new ApiError("RESPONSE_INVALID", "Resultado no confirmado.");
      if (!(await authorize())) {
        emit({ message: "La cuenta cambió. Actualiza la bandeja." });
        return;
      }
      pending = null;
      emit({
        detail: { ...state.detail, ...result },
        items: state.items.map((item) =>
          item.requestId === result.requestId
            ? {
                ...item,
                status: result.status,
                revision: result.revision,
                reviewedAt: result.reviewedAt,
              }
            : item,
        ),
        uncertain: false,
        message:
          "Verificación guardada. El comprador ya puede solicitar un nuevo resumen.",
      });
    } catch (error) {
      if (error.code === "REQUEST_ABORTED") return;
      const uncertain = !error.status || error.status >= 500;
      if (!uncertain) pending = null;
      emit({
        uncertain,
        message: uncertain
          ? "No pudimos confirmar el guardado. Conservamos el mismo envío: reinténtalo para recuperar el resultado."
          : benefitMessage(error),
        ...(error.code === "BOOKING_BENEFIT_REVIEW_CONFLICT"
          ? { detail: null }
          : {}),
      });
      if (["UNAUTHENTICATED", "FORBIDDEN"].includes(error.code)) throw error;
    }
  }
  return {
    get state() {
      return copy(state);
    },
    forget() {
      epoch += 1;
      identity = null;
      clear();
      emit({
        message:
          "Datos privados retirados. Actualiza la bandeja para continuar.",
      });
    },
    load(cursor = null) {
      return action(async () => {
        const same = await authorize();
        if (pending) {
          emit({ message: "Recupera primero el guardado pendiente." });
          return;
        }
        emit({ detail: null, items: [], nextCursor: null });
        const page = await api.list(same ? cursor : null);
        if (
          !Array.isArray(page?.requests) ||
          !(page.nextCursor === null || UUID.test(page.nextCursor))
        )
          throw new ApiError("RESPONSE_INVALID", "Bandeja inválida.");
        if (!(await authorize())) {
          emit({ message: "La cuenta cambió. Actualiza la bandeja." });
          return;
        }
        emit({
          items: page.requests.map(readBenefitRequest),
          nextCursor: page.nextCursor,
          message: page.requests.length
            ? "Selecciona una solicitud para revisar sus documentos."
            : "No hay solicitudes en esta página.",
        });
      });
    },
    open(id) {
      return action(async () => {
        if (pending) {
          emit({ message: "Recupera primero el guardado pendiente." });
          return;
        }
        if (!(await authorize())) {
          emit({ message: "La cuenta cambió. Actualiza la bandeja." });
          return;
        }
        emit({ detail: null });
        const detail = readBenefitRequest((await api.get(id)).request);
        if (
          detail.requestId !== id ||
          !Array.isArray(detail.passengers) ||
          !detail.passengers.length ||
          new Set(detail.passengers.map((p) => p.seatId)).size !==
            detail.passengers.length
        )
          throw new ApiError("RESPONSE_INVALID", "Detalle inválido.");
        if (!(await authorize())) {
          emit({ message: "La cuenta cambió. Actualiza la bandeja." });
          return;
        }
        emit({
          detail,
          message:
            "Contrasta los documentos presentados antes de marcar cada verificación.",
        });
      });
    },
    save(decisions) {
      return action(async () => {
        if (pending || !state.detail || state.detail.status !== "PENDING")
          return;
        const detail = state.detail;
        if (!(await authorize()) || !state.detail) {
          emit({ message: "La cuenta cambió. Actualiza la bandeja." });
          return;
        }
        pending = {
          id: detail.requestId,
          command: {
            expectedRevision: detail.revision,
            decisions: copy(decisions),
          },
        };
        await sendPending();
      });
    },
    retry() {
      return action(async () => {
        if (!pending) return;
        if (!(await authorize()) || !pending) {
          emit({ message: "La cuenta cambió. Actualiza la bandeja." });
          return;
        }
        await sendPending();
      });
    },
  };
}
export function createBenefitBuyer({ api, newKey }) {
  let epoch = 0;
  api = guardedApi(api, () => epoch);
  let attempt = null,
    busy = false,
    request = null;
  return {
    get state() {
      return { busy, request: request && copy(request), pending: !!attempt };
    },
    forget() {
      epoch += 1;
      attempt = null;
      request = null;
    },
    async submit(input) {
      if (busy) return;
      if (attempt && JSON.stringify(attempt.input) !== JSON.stringify(input))
        throw new ApiError(
          "BENEFIT_PENDING",
          "Consulta primero el intento anterior.",
        );
      busy = true;
      try {
        const { user } = await api.session();
        if (user?.role !== "CUSTOMER")
          throw new ApiError("FORBIDDEN", "Inicia sesión como cliente.", 403);
        if (attempt && attempt.owner !== user.id) {
          attempt = null;
          request = null;
          throw new ApiError("UNAUTHENTICATED", "La cuenta cambió.", 401);
        }
        attempt ||= { input: copy(input), key: newKey(), owner: user.id };
        const result = readBenefitRequest(
          (
            await api.create({
              ...copy(attempt.input),
              requestKey: attempt.key,
            })
          ).request,
        );
        const current = (await api.session()).user;
        if (current?.role !== "CUSTOMER" || current.id !== attempt?.owner)
          throw new ApiError("UNAUTHENTICATED", "La cuenta cambió.", 401);
        request = result;
        return copy(request);
      } catch (error) {
        if (["UNAUTHENTICATED", "FORBIDDEN"].includes(error.code)) {
          attempt = null;
          request = null;
        }
        throw error;
      } finally {
        busy = false;
      }
    },
    async refresh() {
      if (busy || !request) return;
      busy = true;
      try {
        const { user } = await api.session();
        if (user?.role !== "CUSTOMER" || user.id !== attempt?.owner)
          throw new ApiError("UNAUTHENTICATED", "La cuenta cambió.", 401);
        const result = readBenefitRequest(
          (await api.get(request.requestId)).request,
        );
        if (result.requestId !== request.requestId)
          throw new ApiError("RESPONSE_INVALID", "Solicitud inválida.");
        const current = (await api.session()).user;
        if (current?.role !== "CUSTOMER" || current.id !== attempt?.owner)
          throw new ApiError("UNAUTHENTICATED", "La cuenta cambió.", 401);
        request = result;
        return copy(request);
      } catch (error) {
        if (["UNAUTHENTICATED", "FORBIDDEN"].includes(error.code)) {
          attempt = null;
          request = null;
        }
        throw error;
      } finally {
        busy = false;
      }
    },
  };
}
