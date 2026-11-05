const SESSION_PATH = "/api/v1/auth/me";
const LOGIN_PATH = "/api/v1/auth/login";
const LOGOUT_PATH = "/api/v1/auth/logout";
const MIN_PASSWORD_LENGTH = 15;
const MAX_PASSWORD_LENGTH = 128;
const MAX_EMAIL_LENGTH = 254;
const REJECTIONS = {
  VALIDATION_ERROR: "Revisa el correo y la contraseña e inténtalo de nuevo.",
  INVALID_CREDENTIALS: "El correo o la contraseña no son correctos.",
  CSRF_TOKEN_INVALID: "La solicitud venció. Vuelve a intentar iniciar sesión.",
  TOO_MANY_ATTEMPTS: "Se alcanzó el límite de intentos. Inténtalo más tarde.",
};

export function createLoginController({
  client,
  view,
  onAuthenticated = () => {},
}) {
  let busy = false;
  let canSubmit = false;
  let canLogout = false;
  let changingAccount = false;

  function render(mode, message, extra = {}) {
    canSubmit = mode === "form";
    canLogout = mode === "session";
    view.render({ mode, message, ...extra });
  }

  async function verifySession(afterLogin = false) {
    try {
      const result = await client.request(SESSION_PATH);
      if (typeof result?.user?.email !== "string" || !result.user.email)
        throw new Error();
      render(
        "session",
        changingAccount
          ? "La sesión sigue activa. Vuelve a cerrar sesión para usar otra cuenta."
          : "Sesión iniciada.",
        { email: result.user.email, role: result.user.role },
      );
      if (!changingAccount) onAuthenticated(result.user);
    } catch (error) {
      if (error.status === 401 && !afterLogin) {
        render(
          "form",
          changingAccount
            ? "Sesión cerrada. Introduce los datos de otra cuenta."
            : "Introduce tus datos para iniciar sesión.",
        );
        changingAccount = false;
      } else {
        render(
          "uncertain",
          changingAccount
            ? "No pudimos confirmar el cierre de sesión. Comprueba tu sesión antes de continuar."
            : "No pudimos confirmar tu sesión. Puedes comprobarla de nuevo.",
        );
      }
    }
  }

  async function checkSession() {
    if (busy) return;
    busy = true;
    render("checking", "Comprobando tu sesión…");
    try {
      await verifySession();
    } finally {
      busy = false;
    }
  }

  async function submit({ email, password }) {
    if (busy || !canSubmit) return;
    const validEmail =
      typeof email === "string" &&
      email.trim().length <= MAX_EMAIL_LENGTH &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email.trim());
    const length = typeof password === "string" ? [...password].length : 0;
    if (
      !validEmail ||
      length < MIN_PASSWORD_LENGTH ||
      length > MAX_PASSWORD_LENGTH
    ) {
      view.clearPassword();
      render(
        "form",
        validEmail
          ? "La contraseña debe tener entre 15 y 128 caracteres."
          : "Introduce un correo electrónico válido (máximo 254 caracteres).",
        { errorField: validEmail ? "password" : "email" },
      );
      return;
    }
    busy = true;
    render("submitting", "Iniciando sesión…");
    try {
      await client.request(LOGIN_PATH, {
        method: "POST",
        data: { email, password },
      });
      await verifySession(true);
    } catch (error) {
      if (REJECTIONS[error.code]) {
        render("form", REJECTIONS[error.code], { errorField: "password" });
      } else {
        render(
          "uncertain",
          "No pudimos confirmar el resultado. Comprueba tu sesión antes de volver a intentarlo.",
        );
      }
    } finally {
      view.clearPassword();
      busy = false;
    }
  }

  async function changeAccount() {
    if (busy || !canLogout) return;
    busy = true;
    changingAccount = true;
    view.clearCredentials();
    render("signing-out", "Cerrando sesión…");
    try {
      try {
        await client.request(LOGOUT_PATH, { method: "POST" });
      } catch {
        // Una respuesta perdida no prueba si el servidor revocó la sesión.
      }
      await verifySession();
    } finally {
      busy = false;
    }
  }

  return { checkSession, submit, changeAccount };
}
