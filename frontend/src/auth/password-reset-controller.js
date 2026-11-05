const REQUEST_PATH = "/api/v1/auth/password-reset";
const CONFIRM_PATH = "/api/v1/auth/password-reset/confirm";
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function takeResetToken(location, history) {
  const fragment = new URLSearchParams(location.hash.slice(1));
  const values = fragment.getAll("token");
  history.replaceState(null, "", location.pathname);
  return values.length === 1 && TOKEN.test(values[0]) ? values[0] : null;
}

export function createPasswordResetController({ client, view, token }) {
  let busy = false;
  let activeToken = token;

  function ready() {
    if (!activeToken) {
      view.render({
        mode: "invalid",
        message: "El enlace no es válido o ha vencido. Pide otro.",
      });
      return;
    }
    view.render({
      mode: "ready",
      message: "Introduce y confirma tu contraseña nueva.",
    });
  }

  async function request(email) {
    if (busy) return;
    const normalized =
      typeof email === "string" ? email.trim().toLowerCase() : "";
    if (
      normalized.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)
    ) {
      view.render({
        mode: "ready",
        message: "Introduce un correo válido.",
        errorField: "email",
      });
      return;
    }
    busy = true;
    view.render({ mode: "busy", message: "Solicitando enlace…" });
    try {
      await client.request(REQUEST_PATH, {
        method: "POST",
        data: { email: normalized },
      });
      view.render({
        mode: "complete",
        message: "Si la cuenta existe, enviaremos un enlace a ese correo.",
      });
    } catch (error) {
      view.render({
        mode: "ready",
        message:
          error.code === "TOO_MANY_ATTEMPTS"
            ? "Se alcanzó el límite de solicitudes. Inténtalo más tarde."
            : "No pudimos registrar la solicitud. Inténtalo de nuevo.",
      });
    } finally {
      busy = false;
    }
  }

  async function confirm(password, confirmation) {
    if (busy || !activeToken) return;
    const length = typeof password === "string" ? [...password].length : 0;
    if (length < 15 || length > 128) {
      view.render({
        mode: "ready",
        message: "La contraseña debe tener entre 15 y 128 caracteres.",
        errorField: "password",
      });
      return;
    }
    if (password !== confirmation) {
      view.render({
        mode: "ready",
        message: "Las contraseñas no coinciden.",
        errorField: "confirmPassword",
      });
      return;
    }
    busy = true;
    view.render({ mode: "busy", message: "Guardando contraseña…" });
    try {
      await client.request(CONFIRM_PATH, {
        method: "POST",
        data: { token: activeToken, password },
      });
      activeToken = null;
      view.clearPasswords();
      view.render({
        mode: "complete",
        message: "Contraseña cambiada. Ya puedes iniciar sesión.",
      });
    } catch (error) {
      view.clearPasswords();
      if (error.code === "INVALID_RESET_TOKEN") {
        activeToken = null;
        view.render({
          mode: "invalid",
          message: "El enlace no es válido o ha vencido. Pide otro.",
        });
      } else {
        view.render({
          mode: "ready",
          message:
            "No pudimos confirmar el cambio. Comprueba tu acceso antes de intentarlo de nuevo.",
        });
      }
    } finally {
      busy = false;
    }
  }

  return { ready, request, confirm };
}
