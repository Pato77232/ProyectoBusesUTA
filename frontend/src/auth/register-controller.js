const REGISTER_PATH = "/api/v1/auth/register";
const MIN_PASSWORD_LENGTH = 15;
const MAX_PASSWORD_LENGTH = 128;
const MAX_EMAIL_LENGTH = 254;

const ERRORS = {
  VALIDATION_ERROR: "Revisa el correo y la contraseña e inténtalo de nuevo.",
  CSRF_TOKEN_INVALID: "La solicitud venció. Vuelve a intentar el registro.",
  REGISTRATION_CONFLICT: "No se pudo completar el registro.",
};

export function createRegisterController({
  client,
  view,
  onRegistered = () => {},
}) {
  let state = "form";

  async function submit({ email, password, confirmation }) {
    if (state !== "form") return;
    const validEmail =
      typeof email === "string" &&
      email.trim().length <= MAX_EMAIL_LENGTH &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email.trim());
    const length = typeof password === "string" ? [...password].length : 0;
    if (
      !validEmail ||
      length < MIN_PASSWORD_LENGTH ||
      length > MAX_PASSWORD_LENGTH ||
      password !== confirmation
    ) {
      view.clearPassword();
      view.render({
        mode: "form",
        message: !validEmail
          ? "Introduce un correo electrónico válido (máximo 254 caracteres)."
          : length < MIN_PASSWORD_LENGTH || length > MAX_PASSWORD_LENGTH
            ? "La contraseña debe tener entre 15 y 128 caracteres."
            : "Las contraseñas no coinciden.",
        errorField: !validEmail
          ? "email"
          : password !== confirmation
            ? "confirmation"
            : "password",
      });
      return;
    }

    state = "submitting";
    view.render({ mode: state, message: "Creando tu cuenta…" });
    let registeredEmail = null;
    try {
      await client.request(REGISTER_PATH, {
        method: "POST",
        data: { email, password },
      });
      state = "success";
      view.render({
        mode: state,
        message: "Tu cuenta se creó. Abriendo el inicio de sesión…",
      });
      registeredEmail = email.trim();
    } catch (error) {
      state = ERRORS[error.code] ? "form" : "uncertain";
      view.render({
        mode: state,
        message:
          ERRORS[error.code] ||
          "No pudimos confirmar si la cuenta se creó. Compruébalo desde Iniciar sesión antes de volver a intentarlo.",
      });
    } finally {
      view.clearPassword();
    }
    if (registeredEmail) onRegistered(registeredEmail);
  }

  return { submit };
}
