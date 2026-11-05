import { createApiClient } from "../api/api-client.js";
import {
  BUS_GROUP_CATEGORIES,
  categoryLabel,
  createBusGroupController,
} from "./bus-group-controller.js";

const status = document.querySelector("#group-status");
const login = document.querySelector("#group-login");
const content = document.querySelector("#group-content");
const form = document.querySelector("#group-form");
const fields = form.querySelector("fieldset");
const list = document.querySelector("#group-list");
const empty = document.querySelector("#group-empty");
const main = document.querySelector("main");

for (const category of BUS_GROUP_CATEGORIES) {
  const option = document.createElement("option");
  option.value = category.value;
  option.textContent = category.label;
  form.elements.category.append(option);
}

function show(message, tone = "info", focus = false) {
  status.textContent = message;
  status.dataset.tone = tone;
  if (focus) status.focus();
}

function stop(message, signedOut = false) {
  main.setAttribute("aria-busy", "false");
  content.hidden = true;
  login.hidden = !signedOut;
  show(message, "error", true);
}

const controller = createBusGroupController({
  client: createApiClient(),
  view: {
    loading(message) {
      main.setAttribute("aria-busy", "true");
      show(message);
    },
    ready() {
      main.setAttribute("aria-busy", "false");
      content.hidden = false;
      fields.disabled = false;
      show("Crea un grupo o revisa los que ya tiene tu cooperativa.");
    },
    groups(groups) {
      list.replaceChildren();
      for (const group of groups) {
        const item = document.createElement("li");
        item.className = "list-group-item d-flex justify-content-between gap-3";
        const name = document.createElement("strong");
        name.textContent = group.name;
        const category = document.createElement("span");
        category.textContent = categoryLabel(group.category);
        item.append(name, category);
        list.append(item);
      }
      empty.hidden = groups.length > 0;
    },
    created() {
      form.reset();
    },
    busy(value) {
      fields.disabled = value;
      form.setAttribute("aria-busy", String(value));
    },
    status(message, tone) {
      show(message, tone, tone !== "info");
    },
    blocked: (message) => stop(message),
    signedOut: (message) => stop(message, true),
    failed: (message) => stop(message),
  },
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  controller.create({
    name: form.elements.name.value,
    category: form.elements.category.value,
  });
});

controller.start();
