// BOLETOS-03 T3: botón «Agregar a Google Wallet» de cada boleto. El servidor decide si
// la función está habilitada y firma el enlace; aquí solo se pide y se abre.
const STATUS_PATH = "/api/v1/tickets/google-wallet/status";
const SAVE_URL_PREFIX = "https://pay.google.com/gp/v/save/";

const MESSAGES = Object.freeze({
  503: "Google Wallet no está disponible en este momento. Usa el QR de esta página.",
  404: "No encontramos este boleto en tu cuenta. Actualiza la página.",
  401: "Tu sesión terminó. Inicia sesión para agregar el boleto.",
  default: "No se pudo preparar el pase. Intenta de nuevo en unos minutos.",
});

export function walletLinkPath(bookingId, ticketId) {
  return (
    "/api/v1/tickets/bookings/" +
    encodeURIComponent(bookingId) +
    "/tickets/" +
    encodeURIComponent(ticketId) +
    "/google-wallet"
  );
}

export function walletMessage(error) {
  return MESSAGES[error?.status] ?? MESSAGES.default;
}

export function createGoogleWalletAction({ client, leave }) {
  let busy = false;
  return {
    async enabled() {
      try {
        return (await client.request(STATUS_PATH))?.enabled === true;
      } catch {
        // Sin respuesta no se ofrece el botón; el QR sigue disponible.
        return false;
      }
    },
    async open(bookingId, ticketId) {
      if (busy) return { ok: false, message: null };
      busy = true;
      try {
        const result = await client.request(
          walletLinkPath(bookingId, ticketId),
        );
        const saveUrl = result?.saveUrl;
        if (typeof saveUrl !== "string" || !saveUrl.startsWith(SAVE_URL_PREFIX))
          return { ok: false, message: MESSAGES.default };
        leave(saveUrl);
        return { ok: true, message: null };
      } catch (error) {
        return { ok: false, message: walletMessage(error) };
      } finally {
        busy = false;
      }
    },
  };
}
