import { createApiClient } from "../api/api-client.js";
import { updateSessionLinks } from "./session-link.js";

updateSessionLinks({
  client: createApiClient(),
  links: [...document.querySelectorAll("[data-session-link]")],
  guestOnly: [...document.querySelectorAll("[data-guest-only]")],
});
