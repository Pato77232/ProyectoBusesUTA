import { createApiClient } from "../api/api-client.js";
import {
  createPasswordResetController,
  takeResetToken,
} from "./password-reset-controller.js";

const confirmForm = document.querySelector("#confirm-form");
const requestForm = document.querySelector("#request-form");
const form = confirmForm || requestForm;
const status = document.querySelector("#reset-status");
const token = confirmForm
  ? takeResetToken(globalThis.location, globalThis.history)
  : null;

const view = {
  render({ mode, message, errorField }) {
    status.textContent = message;
    form.hidden = mode === "complete" || mode === "invalid";
    form.querySelectorAll("input,button").forEach((control) => {
      control.disabled = mode === "busy";
      control.removeAttribute("aria-invalid");
      control.removeAttribute("aria-describedby");
    });
    document
      .querySelector("main")
      .setAttribute("aria-busy", String(mode === "busy"));
    if (errorField) {
      const field = form.elements.namedItem(errorField);
      field.setAttribute("aria-invalid", "true");
      field.setAttribute("aria-describedby", "reset-status");
      field.focus();
    } else if (mode !== "ready") status.focus();
  },
  clearPasswords() {
    if (confirmForm) {
      confirmForm.elements.namedItem("password").value = "";
      confirmForm.elements.namedItem("confirmPassword").value = "";
    }
  },
};

const controller = createPasswordResetController({
  client: createApiClient(),
  view,
  token,
});
if (confirmForm) controller.ready();
form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (confirmForm)
    controller.confirm(
      confirmForm.elements.namedItem("password").value,
      confirmForm.elements.namedItem("confirmPassword").value,
    );
  else controller.request(requestForm.elements.namedItem("email").value);
});
