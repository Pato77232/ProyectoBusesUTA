import { createApiClient } from '../api/api-client.js';
import { createPendingController } from './pending-controller.js';
import { createPendingView } from './pending-view.js';

const view = createPendingView(document);
const controller = createPendingController({ client: createApiClient(), view });
document.querySelector('#refresh').addEventListener('click', () => controller.load());
document.querySelector('#next').addEventListener('click', () => controller.load(true));
document.querySelector('#previous').addEventListener('click', () => controller.previous());
document.querySelector('#retry').addEventListener('click', () => controller.retry());
controller.load();
