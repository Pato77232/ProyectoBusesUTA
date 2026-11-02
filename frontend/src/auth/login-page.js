import { createApiClient } from '../api/api-client.js';
import { createLoginController } from './login-controller.js';
import { createLoginView } from './login-view.js';

const controller = createLoginController({
  client: createApiClient(),
  view: createLoginView(document),
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
