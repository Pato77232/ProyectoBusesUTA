import { createBenefitsApi } from "./benefits-api.js";
import { createBenefitsController } from "./benefits-controller.js";
import { createBenefitsView } from "./benefits-view.js";
const view = createBenefitsView(document);
const controller = createBenefitsController({
  api: createBenefitsApi(),
  render: view.render,
});
const el = (id) => document.getElementById(id);
el("refresh-benefits").addEventListener("click", () => controller.load());
el("next-benefits").addEventListener("click", () =>
  controller.load(controller.state.nextCursor),
);
el("retry-benefits").addEventListener("click", () => controller.retry());
el("benefit-list").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-request-id]");
  if (!button || button.disabled) return;
  await controller.open(button.dataset.requestId);
  (controller.state.detail
    ? el("benefit-detail")
    : el("benefit-status")
  ).focus();
});
el("benefit-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!event.target.reportValidity() || !el("confirmed-context").checked)
    return;
  await controller.save(view.decisions());
  el("benefit-status").focus();
});
window.addEventListener("pagehide", () => controller.forget());
window.addEventListener("pageshow", (event) => {
  if (event.persisted) controller.load();
});
controller.load();
