import { createApiClient } from '../api/api-client.js';
import { createLoginController } from './login-controller.js';
import { createLoginView } from './login-view.js';
import { readReservationReturn, takeRegistrationEmail } from './registration-navigation.js';

let registeredEmail = null;
try {
  registeredEmail = takeRegistrationEmail(document.defaultView.sessionStorage);
} catch {
  // El login sigue disponible sin precarga.
}
if (registeredEmail) document.querySelector('#login-email').value = registeredEmail;
const next = readReservationReturn(document.defaultView.location.search);

const controller = createLoginController({
  client: createApiClient(),
  view: createLoginView(document),
  onAuthenticated() {
    if (next) document.defaultView.location.assign(next);
  },
});
document.querySelector('form').addEventListener('submit', (event) => {
  event.preventDefault();
  controller.submit({
    email: document.querySelector('#login-email').value,
    password: document.querySelector('#login-password').value,
  });
});
document.querySelector('#check-session').addEventListener('click', () => controller.checkSession());
controller.checkSession();
