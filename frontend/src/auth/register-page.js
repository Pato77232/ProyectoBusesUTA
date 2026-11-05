import { createApiClient } from "../api/api-client.js";
import { createRegisterController } from "./register-controller.js";
import { createRegisterView } from "./register-view.js";
import {
  loginPath,
  readReservationReturn,
  saveRegistrationEmail,
} from "./registration-navigation.js";

const next = readReservationReturn(document.defaultView.location.search);

const controller = createRegisterController({
  client: createApiClient(),
  view: createRegisterView(document),
  onRegistered(email) {
    try {
      saveRegistrationEmail(document.defaultView.sessionStorage, email);
    } catch {
      // El navegador puede bloquear sessionStorage; el login sigue disponible.
    }
    document.defaultView.location.assign(loginPath(next));
  },
});

document.querySelector("form").addEventListener("submit", (event) => {
  event.preventDefault();
  controller.submit({
    email: document.querySelector("#register-email").value,
    password: document.querySelector("#register-password").value,
    confirmation: document.querySelector("#register-confirmation").value,
  });
});
