import { createApiClient } from "../api/api-client.js";
import { createEditorController } from "./editor-controller.js";
import { createEditorView } from "./editor-view.js";
let controller;
const view = createEditorView(document, {
  edit: (...args) => controller.edit(...args),
  required: (...args) => controller.required(...args),
  removeService: (...args) => controller.removeService(...args),
  agenda: (...args) => controller.agenda(...args),
  activity: (...args) => controller.activity(...args),
  block: (...args) => controller.block(...args),
  reload: () => controller.reload(),
  reconcile: () => controller.reconcile(),
  cancel: () => controller.cancel(),
  confirm: () => controller.confirm(),
});
const params = new URLSearchParams(globalThis.location.search);
const sheetId =
  [...params.keys()].some((key) => key !== "id") ||
  params.getAll("id").length !== 1
    ? ""
    : params.get("id");
controller = createEditorController({
  client: createApiClient(),
  sheetId,
  view,
});
for (const [form, kind] of [
  ["#program-form", "programming"],
  ["#tariff-form", "tariff"],
])
  document.querySelector(form).addEventListener("submit", (event) => {
    event.preventDefault();
    controller.review(kind);
  });
globalThis.addEventListener("beforeunload", (event) => {
  if (controller.hasUnsaved()) {
    event.preventDefault();
    event.returnValue = "";
  }
});
controller.load();
