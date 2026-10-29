import { createJsonTransport } from "../api/json-transport.js";
import { ApiError } from "../api/api-error.js";

export function createBookingsApi(fetchImpl) {
  const send = createJsonTransport(fetchImpl);
  async function csrf() {
    const result = await send("/api/v1/auth/csrf");
    if (typeof result?.csrfToken !== "string" || !result.csrfToken) {
      throw new ApiError(
        "RESPONSE_INVALID",
        "No se pudo preparar la protección del formulario.",
      );
    }
    return result.csrfToken;
  }
  return {
    availability(context) {
      const query = new URLSearchParams(context);
      return send("/api/v1/bookings/availability?" + query);
    },
    async summary(data) {
      return send("/api/v1/bookings/summary", {
        method: "POST",
        data,
        csrfToken: await csrf(),
      });
    },
    async create(data, requestKey) {
      // Reutiliza el transporte común; solo añade la cabecera propia de esta operación.
      const withKey = createJsonTransport((url, options) =>
        fetchImpl(url, {
          ...options,
          headers: { ...options.headers, "Idempotency-Key": requestKey },
        }),
      );
      return withKey("/api/v1/bookings", {
        method: "POST",
        data,
        csrfToken: await csrf(),
      });
    },
    attempt(requestKey) {
      return send(
        "/api/v1/bookings/attempts/" + encodeURIComponent(requestKey),
      );
    },
  };
}

export function readTripContext(search) {
  const query = new URLSearchParams(search);
  const fields = ["tripId", "fromPosition", "toPosition"];
  if (
    [...query.keys()].some((key) => !fields.includes(key)) ||
    fields.some((key) => query.getAll(key).length !== 1)
  )
    return null;
  const tripId = query.get("tripId").trim();
  const values = ["fromPosition", "toPosition"].map((key) => query.get(key));
  if (!tripId || !values.every((value) => /^(0|[1-9]\d*)$/.test(value)))
    return null;
  const [fromPosition, toPosition] = values.map(Number);
  if (
    ![fromPosition, toPosition].every(Number.isSafeInteger) ||
    fromPosition >= toPosition
  )
    return null;
  return Object.freeze({ tripId, fromPosition, toPosition });
}
