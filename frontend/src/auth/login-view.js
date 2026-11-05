export function createLoginView(root) {
  const form = root.querySelector("form");
  const fields = form.querySelector("fieldset");
  const status = root.querySelector("#login-status");
  const email = root.querySelector("#login-email");
  const password = root.querySelector("#login-password");
  const check = root.querySelector("#check-session");
  const identity = root.querySelector("#session-email");
  const administration = root.querySelector("#administration-link");
  const change = root.querySelector("#change-account");
  const destinations = {
    SYSTEM_ADMIN: {
      href: "/pages/cooperativas.html",
      label: "Administrar cooperativas",
    },
    COOPERATIVE_ADMIN: {
      href: "/pages/oficinistas.html",
      label: "Crear oficinistas",
    },
  };

  function render({ mode, message, email: userEmail, role, errorField }) {
    const wasHidden = form.hidden;
    const lostFocus =
      form.contains(root.activeElement) ||
      check === root.activeElement ||
      change === root.activeElement;
    const busy =
      mode === "checking" || mode === "submitting" || mode === "signing-out";
    const showForm = mode === "form" || mode === "submitting";
    status.textContent = message;
    form.hidden = !showForm;
    fields.disabled = mode !== "form";
    form.querySelector("button").disabled = mode !== "form";
    check.hidden = mode !== "uncertain";
    identity.hidden = mode !== "session";
    identity.textContent = mode === "session" ? userEmail : "";
    change.hidden = mode !== "session" && mode !== "signing-out";
    change.disabled = mode !== "session";
    const destination = mode === "session" ? destinations[role] : null;
    administration.hidden = !destination;
    if (destination) {
      administration.href = destination.href;
      administration.textContent = destination.label;
    } else administration.removeAttribute("href");
    root.querySelector("main").setAttribute("aria-busy", String(busy));
    for (const input of [email, password]) {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    }
    if (errorField) {
      const input = errorField === "email" ? email : password;
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", "login-status");
      input.focus();
    } else if (mode === "submitting" || mode === "signing-out") status.focus();
    else if (mode === "form" && wasHidden) email.focus();
    else if (!busy && lostFocus) {
      (mode === "uncertain" ? check : status).focus();
    }
  }

  return {
    render,
    clearCredentials: () => {
      email.value = "";
      password.value = "";
    },
    clearPassword: () => {
      password.value = "";
    },
  };
}
