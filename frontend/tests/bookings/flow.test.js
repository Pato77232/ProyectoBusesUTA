import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createBookingsApi, readTripContext } from "../../src/bookings/api.js";
import {
  createAttemptStore,
  createBookingFlow,
  ATTEMPT_STORAGE_KEY,
} from "../../src/bookings/flow.js";
import { ApiError } from "../../src/api/api-error.js";

const require = createRequire(import.meta.url);
const {
  summaryInput,
  summaryContext,
} = require("../../../backend/tests/unit/bookings/helpers/booking-summary-fixtures");
const {
  createBookingSummary,
} = require("../../../backend/src/modules/bookings/domain/booking-summary");
const key = "00000000-0000-4000-8000-000000000001";
const input = () => summaryInput();
const review = () => ({
  summary: createBookingSummary(input(), summaryContext()),
  summaryRevision: "a".repeat(64),
});
const saved = () => ({
  booking: {
    bookingId: "reserva-sintetica",
    ownerId: "cliente-sintetico",
    status: "PENDING_PAYMENT",
    summary: review().summary,
    createdAt: "2026-10-27T15:00:00Z",
    expiresAt: "2026-10-27T15:03:00Z",
  },
});
function storage() {
  const values = new Map();
  return {
    values,
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => values.set(name, value),
    removeItem: (name) => values.delete(name),
  };
}
function setup() {
  const backing = storage();
  const store = createAttemptStore(backing);
  const api = {
    summary: mock.fn(async () => review()),
    create: mock.fn(async () => saved()),
    attempt: mock.fn(async () => saved()),
  };
  const newKey = mock.fn(() => key);
  return {
    backing,
    store,
    api,
    newKey,
    flow: createBookingFlow({ api, attemptStore: store, newKey }),
  };
}

test("adaptador usa transporte común, CSRF y cabecera de intento sin modificar el cuerpo", async () => {
  const requests = [];
  const send = async (url, options) => {
    requests.push({ url, options });
    return new Response(
      JSON.stringify(
        url.endsWith("/csrf") ? { csrfToken: "token-ficticio" } : saved(),
      ),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const api = createBookingsApi(send);
  const body = {
    ...input(),
    summaryAccepted: true,
    acceptedSummaryRevision: "a".repeat(64),
  };
  await api.create(body, key);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].options.headers["Idempotency-Key"], key);
  assert.equal(requests[1].options.headers["X-CSRF-Token"], "token-ficticio");
  assert.equal(requests[1].options.credentials, "same-origin");
  assert.equal(requests[1].options.cache, "no-store");
  assert.equal(JSON.parse(requests[1].options.body).requestKey, undefined);
  assert.deepEqual(JSON.parse(requests[1].options.body), body);
});

test("lectura del resultado no pide CSRF ni realiza POST", async () => {
  const calls = [];
  const api = createBookingsApi(async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify(saved()), {
      headers: { "Content-Type": "application/json" },
    });
  });
  await api.attempt(key);
  assert.equal(calls[0].url, "/api/v1/bookings/attempts/" + key);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls.length, 1);
});

test("no reintenta mutaciones automáticamente si el transporte falla", async () => {
  let creates = 0;
  const api = createBookingsApi(async (url) => {
    if (url.endsWith("/csrf"))
      return new Response('{"csrfToken":"ficticio"}', {
        headers: { "Content-Type": "application/json" },
      });
    creates += 1;
    throw new Error("conexión perdida");
  });
  await assert.rejects(api.create({}, key), { code: "NETWORK_ERROR" });
  assert.equal(creates, 1);
});

test("contexto válido solo contiene viaje y tramo, sin datos personales", () => {
  assert.deepEqual(
    readTripContext("?tripId=viaje&fromPosition=0&toPosition=2"),
    { tripId: "viaje", fromPosition: 0, toPosition: 2 },
  );
});
for (const query of [
  "",
  "?tripId=x",
  "?tripId=x&fromPosition=-1&toPosition=2",
  "?tripId=x&fromPosition=1&toPosition=1",
  "?tripId=x&fromPosition=1.5&toPosition=2",
  "?tripId=x&tripId=y&fromPosition=0&toPosition=2",
  "?tripId=x&fromPosition=0&toPosition=2&ownerId=otro",
]) {
  test("entrada de viaje inválida no inicia consulta: " + query, () =>
    assert.equal(readTripContext(query), null),
  );
}

test("referencia de pestaña solo guarda UUID, sin pasajeros o tokens", async () => {
  const { flow, backing } = setup();
  await flow.review(input());
  await flow.confirm(true);
  assert.deepEqual([...backing.values], [[ATTEMPT_STORAGE_KEY, key]]);
  assert.doesNotMatch(
    JSON.stringify([...backing.values]),
    /Pasajera|0100000009|token/,
  );
});

test("aceptación explícita es obligatoria y no se reserva al consultar resumen", async () => {
  const { flow, api } = setup();
  await assert.rejects(flow.confirm(true), {
    code: "BOOKING_ACCEPTANCE_REQUIRED",
  });
  await flow.review(input());
  await assert.rejects(flow.confirm(false), {
    code: "BOOKING_ACCEPTANCE_REQUIRED",
  });
  assert.equal(api.create.mock.callCount(), 0);
});

test("doble confirmación concurrente envía una sola creación con una sola referencia", async () => {
  const { flow, api, newKey } = setup();
  let release;
  api.create.mock.mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  await flow.review(input());
  const first = flow.confirm(true);
  await assert.rejects(flow.confirm(true), { code: "BOOKING_BUSY" });
  assert.equal(flow.state.locked, true);
  assert.equal(newKey.mock.callCount(), 1);
  release(saved());
  await first;
  assert.equal(api.create.mock.callCount(), 1);
});

test("copias del resumen aceptado no cambian si se modifica el formulario después", async () => {
  const { flow, api } = setup();
  const body = input();
  await flow.review(body);
  body.passengers[0].fullName = "Otra persona";
  await flow.confirm(true);
  assert.equal(
    api.create.mock.calls[0].arguments[0].passengers[0].fullName,
    "Pasajera Menor",
  );
});

test("corte conserva cuerpo y clave para reintento explícito de la misma compra", async () => {
  const { flow, api, backing } = setup();
  let calls = 0;
  api.create.mock.mockImplementation(async () => {
    calls += 1;
    if (calls === 1) throw new ApiError("NETWORK_ERROR", "corte");
    return saved();
  });
  await flow.review(input());
  await assert.rejects(flow.confirm(true), { code: "NETWORK_ERROR" });
  assert.equal(backing.getItem(ATTEMPT_STORAGE_KEY), key);
  assert.equal(flow.state.locked, true);
  await flow.retry();
  assert.deepEqual(
    api.create.mock.calls[0].arguments,
    api.create.mock.calls[1].arguments,
  );
});

test("recarga recupera por GET sin reconstruir ni almacenar el cuerpo de pasajeros", async () => {
  const { backing, api, store, newKey } = setup();
  backing.setItem(ATTEMPT_STORAGE_KEY, key);
  const restored = createBookingFlow({ api, attemptStore: store, newKey });
  assert.equal(restored.state.canRetry, false);
  const booking = await restored.recover();
  assert.equal(booking.bookingId, "reserva-sintetica");
  assert.equal(api.create.mock.callCount(), 0);
  assert.equal(newKey.mock.callCount(), 0);
  assert.equal(booking.expiresAt, saved().booking.expiresAt);
});

test("404 tras recarga conserva referencia y no afirma que la compra falló", async () => {
  const { backing, api, store, newKey } = setup();
  backing.setItem(ATTEMPT_STORAGE_KEY, key);
  api.attempt.mock.mockImplementation(async () => {
    throw new ApiError("BOOKING_ATTEMPT_NOT_FOUND", "sin resultado", 404);
  });
  const restored = createBookingFlow({ api, attemptStore: store, newKey });
  await assert.rejects(restored.recover(), {
    code: "BOOKING_ATTEMPT_NOT_FOUND",
  });
  assert.equal(store.read(), key);
  await assert.rejects(restored.review(input()), { code: "BOOKING_PENDING" });
  await assert.rejects(restored.retry(), { code: "BOOKING_PENDING" });
  assert.equal(api.create.mock.callCount(), 0);
});

test("500 de creación conserva intento porque su resultado puede ser desconocido", async () => {
  const { flow, api, store } = setup();
  api.create.mock.mockImplementation(async () => {
    throw new ApiError("SERVER_ERROR", "fallo", 500);
  });
  await flow.review(input());
  await assert.rejects(flow.confirm(true), { code: "SERVER_ERROR" });
  assert.equal(store.read(), key);
  assert.equal(flow.state.locked, true);
});
for (const code of [
  "BOOKING_SUMMARY_CHANGED",
  "BOOKING_SEAT_CONFLICT",
  "BOOKING_VALIDATION_ERROR",
]) {
  test(
    "rechazo definitivo " + code + " permite corregir sin aceptación vieja",
    async () => {
      const { flow, api, store } = setup();
      api.create.mock.mockImplementation(async () => {
        throw new ApiError(code, "rechazo", 409);
      });
      await flow.review(input());
      await assert.rejects(flow.confirm(true), { code });
      assert.equal(store.read(), null);
      assert.equal(flow.state.review, null);
      assert.equal(flow.state.locked, false);
      await assert.rejects(flow.confirm(true), {
        code: "BOOKING_ACCEPTANCE_REQUIRED",
      });
    },
  );
}
test("referencia vinculada a otros datos no crea otra compra automáticamente", async () => {
  const { flow, api, store } = setup();
  api.create.mock.mockImplementation(async () => {
    throw new ApiError("BOOKING_REQUEST_KEY_REUSED", "conflicto", 409);
  });
  await flow.review(input());
  await assert.rejects(flow.confirm(true), {
    code: "BOOKING_REQUEST_KEY_REUSED",
  });
  assert.equal(store.read(), key);
  assert.equal(flow.state.locked, true);
});
test("respuesta de éxito malformada mantiene referencia para consultar, sin inventar recibo", async () => {
  const { flow, api, store } = setup();
  api.create.mock.mockImplementation(async () => ({}));
  await flow.review(input());
  await assert.rejects(flow.confirm(true), { code: "RESPONSE_INVALID" });
  assert.equal(flow.state.booking, null);
  assert.equal(store.read(), key);
});
test("almacenamiento bloqueado impide POST y no guarda un cuerpo privado como alternativa", async () => {
  const { api, newKey } = setup();
  const store = createAttemptStore({
    getItem: () => null,
    setItem: () => {
      throw new Error();
    },
  });
  const flow = createBookingFlow({ api, newKey, attemptStore: store });
  await flow.review(input());
  await assert.rejects(flow.confirm(true), { code: "BOOKING_STORAGE_ERROR" });
  assert.equal(api.create.mock.callCount(), 0);
});
test("referencia corrupta no se borra para iniciar otra compra silenciosamente", () => {
  const { api, newKey, backing } = setup();
  backing.setItem(ATTEMPT_STORAGE_KEY, "dato-corrupto");
  assert.throws(
    () =>
      createBookingFlow({
        api,
        newKey,
        attemptStore: createAttemptStore(backing),
      }),
    { code: "BOOKING_STORAGE_ERROR" },
  );
  assert.equal(backing.getItem(ATTEMPT_STORAGE_KEY), "dato-corrupto");
});
test("resumen de otro viaje no se puede aceptar aunque tenga totales válidos", async () => {
  const { flow, api } = setup();
  api.summary.mock.mockImplementation(async () => ({
    ...review(),
    summary: { ...review().summary, tripId: "otro" },
  }));
  await assert.rejects(flow.review(input()), { code: "RESPONSE_INVALID" });
  assert.equal(flow.state.review, null);
});
test("solo finalizar una reserva confirmada retira la referencia de la pestaña", async () => {
  const { flow, store } = setup();
  assert.throws(() => flow.finish(), { code: "BOOKING_PENDING" });
  await flow.review(input());
  await flow.confirm(true);
  flow.finish();
  assert.equal(store.read(), null);
});

test("pérdida de sesión retira cuerpo y recibo privados pero conserva referencia para GET", async () => {
  const { flow, store, api } = setup();
  await flow.review(input());
  await flow.confirm(true);
  flow.forgetPrivateData();
  assert.equal(flow.state.review, null);
  assert.equal(flow.state.booking, null);
  assert.equal(flow.state.canRetry, false);
  assert.equal(store.read(), key);
  await assert.rejects(flow.retry(), { code: "BOOKING_PENDING" });
  assert.equal(api.create.mock.callCount(), 1);
  await flow.recover();
  assert.equal(flow.state.booking.bookingId, "reserva-sintetica");
  assert.equal(api.create.mock.callCount(), 1);
});
