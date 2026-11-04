// FLEET-05 T3: punto de entrada de registrar-bus.html.
import { createApiClient } from '../api/api-client.js';
import { createBusController } from './bus-controller.js';
import { createBusFormView } from './bus-form-view.js';

const form = document.querySelector('#bus-form');
createBusController({ client: createApiClient(), view: createBusFormView(form) }).start();
