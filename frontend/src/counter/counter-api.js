import { createJsonTransport } from "../api/json-transport.js";
import { ApiError } from "../api/api-error.js";

// BOOK-CAJA-02: llamadas de la boletería. Crear la reserva añade `Idempotency-Key`,
// que el cliente común no envía; por eso usa su propio transporte con el mismo CSRF.
export function createCounterApi({ client, fetchImpl }) {
  const query = (context) => new URLSearchParams(context);
  return {
    session: () => client.request("/api/v1/auth/me"),
    searchTrips: (input) =>
      client.request("/api/v1/trips?" + new URLSearchParams(input)),
    // SEARCH-02: viajes del día de la cooperativa, sin escribir ciudades.
    upcoming: (input) =>
      client.request("/api/v1/trips/upcoming?" + new URLSearchParams(input)),
    seatMap: (context) =>
      client.request("/api/v1/counter/seat-map?" + query(context)),
    availability: (context) =>
      client.request("/api/v1/counter/availability?" + query(context)),
    summary: (data) =>
      client.request("/api/v1/counter/bookings/summary", {
        method: "POST",
        data,
      }),
    async create(data, requestKey) {
      // Se pide por el cliente común para que este descarte su token anterior y no
      // envíe uno vencido en el cobro siguiente.
      const token = (await client.request("/api/v1/auth/csrf"))?.csrfToken;
      if (typeof token !== "string" || !token)
        throw new ApiError(
          "RESPONSE_INVALID",
          "No se pudo preparar la protección del formulario.",
        );
      const withKey = createJsonTransport((url, options) =>
        fetchImpl(url, {
          ...options,
          headers: { ...options.headers, "Idempotency-Key": requestKey },
        }),
      );
      return withKey("/api/v1/counter/bookings", {
        method: "POST",
        data,
        csrfToken: token,
      });
    },
    cash: (bookingId, data) =>
      client.request(
        "/api/v1/counter/bookings/" + encodeURIComponent(bookingId) + "/cash",
        { method: "POST", data },
      ),
    tickets: (bookingId) =>
      client.request(
        "/api/v1/tickets/counter/bookings/" + encodeURIComponent(bookingId),
      ),
  };
}
