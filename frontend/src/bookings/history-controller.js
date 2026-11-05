import { ApiError } from "../api/api-error.js";
const STATES = new Set(["PENDING_PAYMENT", "SOLD", "EXPIRED", "REJECTED"]);
function booking(value) {
  if (
    !value ||
    typeof value.bookingId !== "string" ||
    !value.bookingId ||
    !STATES.has(value.status) ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    value.summary?.currency !== "USD" ||
    !Number.isSafeInteger(value.summary?.totals?.totalPriceCents) ||
    value.summary.totals.totalPriceCents < 0 ||
    !Array.isArray(value.summary.passengers)
  )
    throw new ApiError("RESPONSE_INVALID", "Respuesta de reserva inválida.");
  return value;
}
export function createHistoryController({ api, render }) {
  let epoch = 0,
    identity = null;
  let state = {
    busy: false,
    items: [],
    detail: null,
    cursor: null,
    message: "",
    login: false,
  };
  const emit = (patch) => {
    state = { ...state, ...patch };
    render(state);
  };
  const clear = () => emit({ items: [], detail: null, cursor: null });
  async function session(generation) {
    const { user } = await api.request("/api/v1/auth/me");
    if (generation !== epoch)
      throw new ApiError("REQUEST_ABORTED", "Vista cerrada.");
    if (user?.role !== "CUSTOMER" || typeof user.id !== "string")
      throw new ApiError("UNAUTHENTICATED", "Inicia sesión como cliente.", 401);
    if (identity !== null && identity !== user.id) {
      identity = user.id;
      clear();
      throw new ApiError(
        "ACCOUNT_CHANGED",
        "La cuenta cambió. Actualiza para consultar sus reservas.",
      );
    }
    identity = user.id;
  }
  async function run(work) {
    if (state.busy) return;
    const generation = epoch;
    emit({ busy: true, login: false, message: "Consultando…" });
    try {
      await session(generation);
      const result = await work();
      await session(generation);
      emit(result);
    } catch (error) {
      if (generation !== epoch) return;
      clear();
      const login = [401, 403].includes(error.status);
      if (login) identity = null;
      emit({
        login,
        message: login
          ? "Inicia sesión con una cuenta de cliente para ver tus reservas."
          : error.status === 404
            ? "La reserva no está disponible para esta cuenta."
            : error.code === "ACCOUNT_CHANGED"
              ? error.message
              : "No pudimos consultar las reservas. Puedes actualizar e intentarlo de nuevo.",
      });
    } finally {
      if (generation === epoch) emit({ busy: false });
    }
  }
  return {
    load(next = false) {
      const cursor = next ? state.cursor : null;
      return run(async () => {
        clear();
        const result = await api.request(
          "/api/v1/bookings?" +
            new URLSearchParams({ limit: "20", ...(cursor ? { cursor } : {}) }),
        );
        const page = result?.bookings;
        if (
          !Array.isArray(page?.items) ||
          !(page.nextCursor === null || typeof page.nextCursor === "string")
        )
          throw new ApiError("RESPONSE_INVALID", "Historial inválido.");
        const items = page.items.map(booking);
        if (new Set(items.map((item) => item.bookingId)).size !== items.length)
          throw new ApiError("RESPONSE_INVALID", "Historial inválido.");
        return {
          items,
          detail: null,
          cursor: page.nextCursor,
          message: items.length
            ? "Selecciona una reserva para consultar su detalle."
            : "No hay reservas en esta página.",
        };
      });
    },
    open(id) {
      if (!state.items.some((item) => item.bookingId === id)) return;
      return run(async () => {
        emit({ detail: null });
        const detail = booking(
          (await api.request("/api/v1/bookings/" + encodeURIComponent(id)))
            .booking,
        );
        if (detail.bookingId !== id)
          throw new ApiError("RESPONSE_INVALID", "Detalle inválido.");
        return { detail, message: "Detalle actualizado desde el servidor." };
      });
    },
    forget() {
      epoch++;
      identity = null;
      clear();
      emit({
        busy: false,
        message: "Datos privados retirados. Actualiza para continuar.",
      });
    },
  };
}
