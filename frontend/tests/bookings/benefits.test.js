import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import assert from "node:assert/strict";
import {
  createBenefitsController,
  createBenefitBuyer,
} from "../../src/bookings/benefits-controller.js";
import { createBenefitsApi } from "../../src/bookings/benefits-api.js";
import { ApiError } from "../../src/api/api-error.js";
const id = "10000000-0000-4000-8000-000000000001";
const request = {
  requestId: id,
  status: "PENDING",
  revision: 1,
  fromPlace: "Origen",
  toPlace: "Destino",
  expiresAt: "2030-01-01T12:00:00Z",
  passengers: [{ seatId: "seat-1" }],
};
const decisions = [
  {
    seatId: "seat-1",
    birthDateVerified: true,
    disabilityVerified: false,
    evidence: [{ kind: "IDENTITY", reference: "ref_identidad" }],
  },
];
const reviewed = {
  ...request,
  status: "REVIEWED",
  revision: 2,
  review: { decisions },
};
function setup() {
  const calls = [],
    states = [];
  let user = { id: "clerk-1", role: "CLERK", cooperative_id: "coop-1" };
  const api = {
    session: async () => ({ user }),
    list: async (cursor) => {
      calls.push(["list", cursor]);
      return { requests: [request], nextCursor: id };
    },
    get: async () => ({ request }),
    review: async (id, data) => {
      calls.push(["review", id, data]);
      return { request: reviewed };
    },
  };
  const controller = createBenefitsController({
    api,
    render: (state) => states.push(state),
  });
  return {
    api,
    controller,
    calls,
    states,
    setUser: (value) => {
      user = value;
    },
  };
}
test("bandeja requiere CLERK y no consulta datos para otro rol", async () => {
  const f = setup();
  f.setUser({ role: "CUSTOMER" });
  await f.controller.load();
  assert.equal(f.calls.length, 0);
  assert.equal(f.controller.state.detail, null);
});
test("bandeja paginada y detalle se obtienen tras comprobar sesión", async () => {
  const f = setup();
  await f.controller.load();
  await f.controller.load(id);
  await f.controller.open(id);
  assert.deepEqual(f.calls.slice(0, 2), [
    ["list", null],
    ["list", id],
  ]);
  assert.equal(f.controller.state.detail.requestId, id);
});
test("revisión usa versión persistida, una sola llamada mientras está ocupado", async () => {
  const f = setup();
  await f.controller.load();
  await f.controller.open(id);
  await Promise.all([
    f.controller.save(decisions),
    f.controller.save(decisions),
  ]);
  assert.equal(f.calls.filter((c) => c[0] === "review").length, 1);
  assert.deepEqual(f.calls.at(-1)[2], { expectedRevision: 1, decisions });
  assert.equal(f.controller.state.detail.revision, 2);
});
test("resultado incierto bloquea navegación y reintenta exactamente la misma intención", async () => {
  const f = setup();
  let fail = true;
  f.api.review = async (id, data) => {
    f.calls.push(["review", id, data]);
    if (fail)
      throw new ApiError("BOOKING_BENEFIT_REVIEW_UNCERTAIN", "incierto", 503);
    return { request: reviewed };
  };
  // El API público se captura al construir el controlador.
  const c = createBenefitsController({ api: f.api, render: () => {} });
  await c.load();
  await c.open(id);
  await c.save(decisions);
  assert.equal(c.state.uncertain, true);
  const before = f.calls.length;
  await c.load();
  assert.equal(f.calls.length, before);
  decisions[0].birthDateVerified = false;
  fail = false;
  await c.retry();
  decisions[0].birthDateVerified = true;
  const attempts = f.calls.filter((c) => c[0] === "review");
  assert.deepEqual(attempts[0], attempts[1]);
  assert.equal(c.state.detail.revision, 2);
});
test("conflicto exige recargar detalle y no muestra éxito", async () => {
  const f = setup();
  const api = {
    ...f.api,
    review: async () => {
      throw new ApiError("BOOKING_BENEFIT_REVIEW_CONFLICT", "conflicto", 409);
    },
  };
  const c = createBenefitsController({ api, render: () => {} });
  await c.open(id);
  await c.save(decisions);
  assert.equal(c.state.detail, null);
  assert.match(c.state.message, /Recarga/);
  assert.equal(c.state.uncertain, false);
});
test("cambio de cuenta impide enviar decisiones de la cuenta anterior", async () => {
  const f = setup();
  await f.controller.open(id);
  f.setUser({ id: "clerk-2", role: "CLERK", cooperative_id: "coop-2" });
  await f.controller.save(decisions);
  assert.equal(f.calls.filter((c) => c[0] === "review").length, 0);
  assert.equal(f.controller.state.detail, null);
});
test("sesión vencida limpia manifiesto y bandeja", async () => {
  const f = setup();
  const api = { ...f.api };
  let expired = false;
  api.session = async () => {
    if (expired) throw new ApiError("UNAUTHENTICATED", "sin sesión", 401);
    return { user: { id: "clerk", role: "CLERK", cooperative_id: "coop" } };
  };
  const c = createBenefitsController({ api, render: () => {} });
  await c.open(id);
  expired = true;
  await c.load();
  assert.deepEqual(c.state.items, []);
  assert.equal(c.state.detail, null);
});
test("respuesta tardía después de cerrar vista no repone datos privados", async () => {
  const f = setup();
  let release;
  const api = {
    ...f.api,
    get: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  };
  const c = createBenefitsController({ api, render: () => {} });
  const task = c.open(id);
  await delay(0);
  c.forget();
  release({ request });
  await task;
  assert.equal(c.state.detail, null);
});
test("respuesta de bandeja inválida no se presenta como lista vacía exitosa", async () => {
  const f = setup();
  const c = createBenefitsController({
    api: { ...f.api, list: async () => ({}) },
    render: () => {},
  });
  await c.load();
  assert.match(c.state.message, /No pudimos/);
  assert.equal(c.state.nextCursor, null);
});
test("comprador conserva requestKey ante respuesta perdida y recibe solo su consulta", async () => {
  const sent = [];
  let fail = true;
  const b = createBenefitBuyer({
    newKey: () => id,
    api: {
      session: async () => ({ user: { id: "customer", role: "CUSTOMER" } }),
      create: async (data) => {
        sent.push(data);
        if (fail) throw new ApiError("NETWORK_ERROR", "red");
        return { request };
      },
      get: async () => ({ request: reviewed }),
    },
  });
  await assert.rejects(b.submit({ tripId: id }));
  fail = false;
  await b.submit({ tripId: id });
  assert.deepEqual(sent[0], sent[1]);
  await b.refresh();
  assert.equal(b.state.request.revision, 2);
  b.forget();
  assert.equal(b.state.request, null);
});
test("comprador no reutiliza solicitud para otra cuenta ni otro contexto", async () => {
  let user = { id: "one", role: "CUSTOMER" };
  let count = 0;
  const b = createBenefitBuyer({
    newKey: () => id,
    api: {
      session: async () => ({ user }),
      create: async () => {
        count++;
        return { request };
      },
      get: async () => ({ request }),
    },
  });
  await b.submit({ tripId: id });
  await assert.rejects(b.submit({ tripId: "another" }));
  user = { id: "two", role: "CUSTOMER" };
  await assert.rejects(b.refresh());
  assert.equal(b.state.request, null);
  assert.equal(count, 1);
});
test("transporte usa el cliente común y codifica referencias sin inventar contexto", async () => {
  const calls = [];
  const api = createBenefitsApi({
    request: async (...args) => calls.push(args),
  });
  await api.list(id);
  await api.review(id, { expectedRevision: 1, decisions });
  assert.deepEqual(calls[1], [
    "/api/v1/booking-benefit-requests/" + id + "/review",
    { method: "POST", data: { expectedRevision: 1, decisions } },
  ]);
});

test("cambio de usuario durante lectura descarta datos de la respuesta anterior", async () => {
  const f = setup();
  const api = {
    ...f.api,
    get: async () => {
      f.setUser({ id: "other", role: "CLERK", cooperative_id: "coop-2" });
      return { request };
    },
  };
  const c = createBenefitsController({ api, render: () => {} });
  await c.open(id);
  assert.equal(c.state.detail, null);
  assert.deepEqual(c.state.items, []);
});

test("respuesta de revisión sin manifiesto conserva el detalle autorizado y actualiza la bandeja", async () => {
  const f = setup();
  const result = { ...reviewed };
  delete result.passengers;
  const c = createBenefitsController({
    api: { ...f.api, review: async () => ({ request: result }) },
    render: () => {},
  });
  await c.load();
  await c.open(id);
  await c.save(decisions);
  assert.deepEqual(c.state.detail.passengers, request.passengers);
  assert.equal(c.state.items[0].status, "REVIEWED");
});
