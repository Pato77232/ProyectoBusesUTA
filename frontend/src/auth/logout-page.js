import { createApiClient } from "../api/api-client.js";
import { bindLogoutButtons } from "./logout.js";

bindLogoutButtons({
  buttons: [...document.querySelectorAll("[data-logout]")],
  client: createApiClient(),
  leave: (path) => document.defaultView.location.assign(path),
});
