import { DASHBOARD_HISTORY_LIMIT, splitTrips } from "./customer-dashboard.js";

const SESSION = "/api/v1/auth/me";
const HISTORY = "/api/v1/bookings?limit=" + DASHBOARD_HISTORY_LIMIT;
const LOGOUT = "/api/v1/auth/logout";

export function createDashboardController({
  client,
  view,
  now = () => Date.now(),
}) {
  let busy = false;

  async function start() {
    view.loading("Preparando tu cuenta…");
    try {
      const { user } = (await client.request(SESSION)) ?? {};
      if (user?.role !== "CUSTOMER" || typeof user.email !== "string") {
        view.signedOut(
          "Inicia sesión con una cuenta de cliente para ver tus viajes.",
        );
        return;
      }
      view.greet(user.email);
      const { bookings } = (await client.request(HISTORY)) ?? {};
      if (!Array.isArray(bookings?.items)) {
        view.failed(
          "No pudimos leer tus viajes. Actualiza la página para intentarlo de nuevo.",
        );
        return;
      }
      view.trips(splitTrips(bookings.items, now()));
    } catch (error) {
      if (error?.status === 401 || error?.status === 403)
        view.signedOut("Tu sesión terminó. Inicia sesión de nuevo.");
      else
        view.failed(
          "No pudimos cargar tus viajes. Comprueba la conexión y actualiza la página.",
        );
    }
  }

  async function logout() {
    if (busy) return;
    busy = true;
    view.loading("Cerrando sesión…");
    try {
      await client.request(LOGOUT, { method: "POST" });
    } catch {
      // Una respuesta perdida no prueba el cierre; el login vuelve a comprobarlo.
    } finally {
      busy = false;
      view.leave("/pages/login.html");
    }
  }

  return { start, logout };
}
