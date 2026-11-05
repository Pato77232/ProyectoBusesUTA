import { createApiClient } from "../api/api-client.js";
import { createCooperativeOperationsController } from "./operations-controller.js";

const status = document.querySelector("#operations-status");
const content = document.querySelector("#operations-content");
const login = document.querySelector("#operations-login");
const main = document.querySelector("main");

const controller = createCooperativeOperationsController({
  client: createApiClient(),
  view: {
    render({ mode, message }) {
      status.textContent = message;
      status.hidden = mode === "ready";
      content.hidden = mode !== "ready";
      login.hidden = !["signed-out", "error", "forbidden"].includes(mode);
      main.setAttribute("aria-busy", String(mode === "checking"));
      if (mode !== "checking") status.focus();
    },
  },
});

controller.start();
