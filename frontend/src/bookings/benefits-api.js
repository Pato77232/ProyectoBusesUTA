import { createApiClient } from "../api/api-client.js";
export const BENEFITS_PATH = "/api/v1/booking-benefit-requests";
export function createBenefitsApi(client = createApiClient()) {
  return {
    session: () => client.request("/api/v1/auth/me"),
    list: (cursor) =>
      client.request(
        BENEFITS_PATH + (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""),
      ),
    get: (id) => client.request(BENEFITS_PATH + "/" + encodeURIComponent(id)),
    create: (data) => client.request(BENEFITS_PATH, { method: "POST", data }),
    review: (id, data) =>
      client.request(BENEFITS_PATH + "/" + encodeURIComponent(id) + "/review", {
        method: "POST",
        data,
      }),
  };
}
