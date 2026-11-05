import { createApiClient } from "../api/api-client.js";
import { createAccountController } from "./account-controller.js";
import { createCooperativesController } from "./cooperatives-controller.js";

const mode = document.body.dataset.adminMode;
const form = document.querySelector("#admin-form");
const fields = form.querySelector("fieldset");
const status = document.querySelector("#admin-status");
const context = document.querySelector("#admin-context");
const list = document.querySelector("#admin-list");
const result = document.querySelector("#admin-result");
const login = document.querySelector("#admin-login");
const refresh = document.querySelector("#admin-refresh");
let denied = false;

function notice(message) {
  status.textContent = message;
  status.focus();
}

function deny(message) {
  denied = true;
  form.hidden = true;
  fields.disabled = true;
  login.hidden = false;
  notice(message);
}

function showAccess(user) {
  context.textContent =
    mode === "clerks"
      ? `Sesión: ${user.email} · Cooperativa: ${user.cooperative_id}`
      : `Sesión: ${user.email}`;
  form.hidden = false;
  login.hidden = true;
}

function setBusy(busy) {
  fields.disabled = denied || busy;
  document.querySelector("main").setAttribute("aria-busy", String(busy));
}

function invalid(field, message) {
  notice(message);
  const input = form.elements.namedItem(field);
  input?.setAttribute("aria-invalid", "true");
  input?.setAttribute(
    "aria-describedby",
    field === "password" ? "admin-password-help admin-status" : "admin-status",
  );
  input?.focus();
}

function clearSecrets() {
  for (const name of ["password", "confirmation"]) {
    const input = form.elements.namedItem(name);
    if (input) input.value = "";
  }
}

function lockUncertain() {
  fields.disabled = true;
  if (refresh) refresh.hidden = mode !== "cooperatives";
}

function showCooperatives(cooperatives, selectedId = null) {
  if (mode === "administrator") {
    const select = form.elements.namedItem("cooperative");
    select.replaceChildren();
    const prompt = document.createElement("option");
    prompt.value = "";
    prompt.textContent = "Selecciona una cooperativa";
    select.append(prompt);
    for (const cooperative of cooperatives) {
      const option = document.createElement("option");
      option.value = cooperative.id;
      option.textContent = `${cooperative.name} · RUC ${cooperative.ruc}`;
      select.append(option);
    }
    select.value = selectedId || "";
    return;
  }
  list.replaceChildren();
  for (const cooperative of cooperatives) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `/pages/administrador-cooperativa.html?cooperativeId=${encodeURIComponent(cooperative.id)}`;
    link.textContent = `${cooperative.name} · RUC ${cooperative.ruc}`;
    item.append(link);
    list.append(item);
  }
  refresh.hidden = false;
}

function showCreated(cooperative) {
  result.replaceChildren();
  const text = document.createElement("p");
  text.textContent = `${cooperative.name} · RUC ${cooperative.ruc} · ID ${cooperative.id}`;
  const link = document.createElement("a");
  link.href = `/pages/administrador-cooperativa.html?cooperativeId=${encodeURIComponent(cooperative.id)}`;
  link.textContent = "Asignar administrador principal";
  result.append(text, link);
  result.hidden = false;
  form.reset();
}

function showResult(user) {
  result.textContent = `${user.email} · ${user.role} · Cooperativa ${user.cooperative_id}`;
  result.hidden = false;
  form.elements.namedItem("email").value = "";
}

function clearResult() {
  result.hidden = true;
  result.replaceChildren();
}

const view = {
  notice,
  deny,
  showAccess,
  setBusy,
  invalid,
  clearSecrets,
  lockUncertain,
  showCooperatives,
  showCreated,
  showResult,
  clearResult,
};
const client = createApiClient();
const requested = new URLSearchParams(
  document.defaultView.location.search,
).getAll("cooperativeId");
const controller =
  mode === "cooperatives"
    ? createCooperativesController({ client, view })
    : createAccountController({
        client,
        view,
        kind: mode,
        requestedCooperativeId: requested.length === 1 ? requested[0] : null,
      });

form.addEventListener("submit", (event) => {
  event.preventDefault();
  for (const input of form.querySelectorAll("[aria-invalid]")) {
    input.removeAttribute("aria-invalid");
    if (input.name === "password")
      input.setAttribute("aria-describedby", "admin-password-help");
    else input.removeAttribute("aria-describedby");
  }
  const value = (name) => form.elements.namedItem(name)?.value || "";
  if (mode === "cooperatives") {
    controller.submit({
      name: value("name"),
      ruc: value("ruc"),
      email: value("email"),
      phone: value("phone"),
      address: value("address"),
    });
  } else {
    controller.submit({
      cooperativeId: value("cooperative"),
      email: value("email"),
      password: value("password"),
      confirmation: value("confirmation"),
    });
  }
});
refresh?.addEventListener("click", () => controller.refresh?.());
controller.start();
