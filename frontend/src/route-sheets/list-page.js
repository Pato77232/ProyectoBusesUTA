import { createApiClient } from '../api/api-client.js';
import { createRouteSheetListController } from './list-controller.js';
import { createRouteSheetListView } from './list-view.js';

const controller = createRouteSheetListController({
  client: createApiClient(),
  view: createRouteSheetListView(document),
});
const form = document.querySelector('#sheet-filters');
const filters = () => ({
  busGroupId: form.elements.busGroupId.value,
  fromDate: form.elements.fromDate.value,
  toDate: form.elements.toDate.value,
  status: form.elements.status.value,
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  controller.load(filters());
});
form.addEventListener('reset', (event) => {
  event.preventDefault();
  for (const name of ['busGroupId', 'fromDate', 'toDate', 'status'])
    form.elements[name].value = '';
  controller.load();
});
document
  .querySelector('#retry')
  .addEventListener('click', () => controller.load(filters()));
controller.load();
