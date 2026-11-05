import test from "node:test";
import assert from "node:assert/strict";
import { createCounterApi } from "../../src/counter/counter-api.js";

test("crear la venta usa el token del cliente común y envía Idempotency-Key", async () => {
  const clientCalls = [];
  const client = {
    async request(path, options) {
      clientCalls.push([path, options]);
      return path === "/api/v1/auth/csrf" ? { csrfToken: "tok-1" } : {};
    },
  };
  const sent = [];
  const fetchImpl = async (url, options) => {
    sent.push([url, options]);
    return new Response(JSON.stringify({ booking: { bookingId: "b-1" } }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  };
  const api = createCounterApi({ client, fetchImpl });
  const result = await api.create({ tripId: "t" }, "key-1");
  assert.equal(result.booking.bookingId, "b-1");
  assert.deepEqual(clientCalls.map(([path]) => path), ["/api/v1/auth/csrf"]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0], "/api/v1/counter/bookings");
  assert.equal(sent[0][1].headers["Idempotency-Key"], "key-1");
  assert.equal(sent[0][1].headers["X-CSRF-Token"], "tok-1");
});
