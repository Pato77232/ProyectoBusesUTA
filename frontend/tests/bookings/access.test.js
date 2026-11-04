import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { createBookingsApi } from "../../src/bookings/api.js";
import { createBookingAccess } from "../../src/bookings/access.js";
import { ApiError } from "../../src/api/api-error.js";

const credentials = {
  email: "cliente-ficticio@example.ec",
  password: "contraseña-ficticia-de-prueba",
};
const customer = {
  user: { id: "cliente", role: "CUSTOMER", cooperative_id: null },
};
test("login real acepta 200 vacío, obtiene CSRF antes de POST y comprueba me después", async () => {
  const calls = [];
  const api = createBookingsApi(async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/csrf"))
      return new Response('{"csrfToken":"csrf-ficticio"}', {
        headers: { "Content-Type": "application/json" },
      });
    if (url.endsWith("/login")) return new Response(null, { status: 200 });
    return new Response(JSON.stringify(customer), {
      headers: { "Content-Type": "application/json" },
    });
  });
  const access = createBookingAccess({ api });
  assert.deepEqual(await access.signIn(credentials), { authenticated: true });
  assert.deepEqual(
    calls.map(({ url }) => url),
    ["/api/v1/auth/csrf", "/api/v1/auth/login", "/api/v1/auth/me"],
  );
  assert.equal(calls[1].options.headers["X-CSRF-Token"], "csrf-ficticio");
  assert.equal(calls[1].options.credentials, "same-origin");
  assert.deepEqual(JSON.parse(calls[1].options.body), credentials);
  assert.deepEqual(access.state, { busy: false });
  assert.equal(
    JSON.stringify(access.state).includes(credentials.password),
    false,
  );
});
test("credenciales incorrectas no consultan me ni se repiten automáticamente", async () => {
  const api = {
    signIn: mock.fn(async () => {
      throw new ApiError("INVALID_CREDENTIALS", "Inválidas", 401);
    }),
    session: mock.fn(),
  };
  const access = createBookingAccess({ api });
  await assert.rejects(access.signIn(credentials), {
    code: "INVALID_CREDENTIALS",
  });
  assert.equal(api.signIn.mock.callCount(), 1);
  assert.equal(api.session.mock.callCount(), 0);
  assert.deepEqual(access.state, { busy: false });
});
test("doble envío mientras entra la cuenta ejecuta un solo login", async () => {
  let release;
  const api = {
    signIn: mock.fn(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    ),
    session: async () => customer,
  };
  const access = createBookingAccess({ api });
  const first = access.signIn(credentials);
  assert.equal(access.state.busy, true);
  await assert.rejects(access.signIn(credentials), { code: "ACCESS_BUSY" });
  release();
  await first;
  assert.equal(api.signIn.mock.callCount(), 1);
});
for (const user of [
  { id: "admin", role: "SYSTEM_ADMIN", cooperative_id: null },
  { id: "oficina", role: "CLERK", cooperative_id: "coop" },
  { id: "cliente", role: "CUSTOMER", cooperative_id: "coop" },
]) {
  test(
    "sesión de rol/contexto distinto no abre reservas: " + user.role,
    async () => {
      const access = createBookingAccess({
        api: { signIn: async () => null, session: async () => ({ user }) },
      });
      await assert.rejects(access.signIn(credentials), { code: "FORBIDDEN" });
    },
  );
}
test("un 200 vacío sin identidad válida no se convierte en acceso confirmado", async () => {
  const access = createBookingAccess({
    api: { signIn: async () => null, session: async () => null },
  });
  await assert.rejects(access.signIn(credentials), {
    code: "RESPONSE_INVALID",
  });
});
test("fallo de lectura de sesión no repite la contraseña ni declara acceso exitoso", async () => {
  const api = {
    signIn: mock.fn(async () => null),
    session: async () => {
      throw new ApiError("NETWORK_ERROR", "corte");
    },
  };
  const access = createBookingAccess({ api });
  await assert.rejects(access.signIn(credentials), { code: "NETWORK_ERROR" });
  assert.equal(api.signIn.mock.callCount(), 1);
  assert.deepEqual(access.state, { busy: false });
});
