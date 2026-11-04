import { createApiClient } from "../api/api-client.js";
import { createFrequencyListController } from "./list-controller.js";
import { createFrequencyListView } from "./list-view.js";
const form = document.querySelector("#frequency-filters");
const filters = () =>
  Object.fromEntries(
    ["origin", "destination", "status"].map((name) => [
      name,
      form.elements[name].value,
    ]),
  );
let controller,
  uncertain = false;
const view = createFrequencyListView(document, {
  onSelect: (id) => controller.select(id),
  onChange: () => controller.beginChange(),
  onCancel: () => controller.cancel(),
  onConfirm: () => controller.confirm(),
  onRetry: () =>
    uncertain ? controller.reconcile() : controller.load(filters()),
});
controller = createFrequencyListController({
  client: createApiClient(),
  view: {
    render(state) {
      uncertain = !!state.uncertain;
      view.render(state);
    },
    setBusy: (busy) => view.setBusy(busy),
  },
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  controller.load(filters());
});
form.addEventListener("reset", (event) => {
  event.preventDefault();
  for (const name of ["origin", "destination", "status"])
    form.elements[name].value = "";
  controller.load();
});
controller.load();
