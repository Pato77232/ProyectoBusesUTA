import { mountFrequencyForm } from './frequency-form-view.js';
import { createFrequencyController } from './frequency-controller.js';
import { createApiClient } from '../api/api-client.js';

let controller;
const form = document.querySelector('#frequency-form');
const view = mountFrequencyForm(form, {
  connected: true,
  onValid: (data) => controller.submit(data),
});
controller = createFrequencyController({ client: createApiClient(), view });
form
  .querySelector('#check-session')
  .addEventListener('click', () => controller.checkSession());
form
  .querySelector('#new-frequency')
  .addEventListener('click', () => controller.startAnother());
controller.checkSession();
