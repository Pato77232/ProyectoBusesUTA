export function createRegisterView(root) {
  const form = root.querySelector("form");
  const fields = form.querySelector("fieldset");
  const status = root.querySelector("#register-status");
  const email = root.querySelector("#register-email");
  const password = root.querySelector("#register-password");
  const confirmation = root.querySelector("#register-confirmation");

  function render({ mode, message, errorField }) {
    status.textContent = message;
    form.hidden = mode === "success" || mode === "uncertain";
    fields.disabled = mode !== "form";
    root
      .querySelector("main")
      .setAttribute("aria-busy", String(mode === "submitting"));
    email.removeAttribute("aria-invalid");
    password.removeAttribute("aria-invalid");
    confirmation.removeAttribute("aria-invalid");
    email.removeAttribute("aria-describedby");
    password.setAttribute("aria-describedby", "password-help");
    confirmation.removeAttribute("aria-describedby");
    if (errorField) {
      const input =
        errorField === "email"
          ? email
          : errorField === "confirmation"
            ? confirmation
            : password;
      input.setAttribute("aria-invalid", "true");
      input.setAttribute(
        "aria-describedby",
        errorField === "password"
          ? "password-help register-status"
          : "register-status",
      );
      input.focus();
    } else if (mode !== "form") {
      status.focus();
    }
  }

  return {
    render,
    clearPassword: () => {
      password.value = "";
      confirmation.value = "";
    },
  };
}
