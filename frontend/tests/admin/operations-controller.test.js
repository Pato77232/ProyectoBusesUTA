import test from "node:test";
import assert from "node:assert/strict";
import { createCooperativeOperationsController } from "../../src/admin/operations-controller.js";

const admin = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "admin@example.ec",
  role: "COOPERATIVE_ADMIN",
  cooperative_id: "00000000-0000-4000-8000-000000000002",
};

function setup(request) {
  const states = [];
  const controller = createCooperativeOperationsController({
    client: { request },
    view: { render: (state) => states.push(state) },
  });
  return { controller, states };
}

test("muestra el menú solo tras verificar el administrador de cooperativa", async () => {
  const calls = [];
  const { controller, states } = setup(async (path) => {
    calls.push(path);
    return { user: admin };
  });

  await controller.start();

  assert.deepEqual(calls, ["/api/v1/auth/me"]);
  assert.equal(states[0].mode, "checking");
  assert.deepEqual(states[1], {
    mode: "ready",
    message: `Sesión de cooperativa: ${admin.email}`,
  });
});

test("deniega otros roles y perfiles de cooperativa inválidos", async () => {
  for (const user of [
    { ...admin, role: "SYSTEM_ADMIN" },
    { ...admin, cooperative_id: null },
    { ...admin, id: "invalid" },
  ]) {
    const { controller, states } = setup(async () => ({ user }));
    await controller.start();
    assert.notEqual(states.at(-1).mode, "ready");
  }
});

test("distingue sesión vencida, acceso denegado y error de conexión", async () => {
  for (const [error, expectedMode] of [
    [{ status: 401 }, "signed-out"],
    [{ status: 403 }, "error"],
    [{ code: "NETWORK_ERROR" }, "error"],
  ]) {
    const { controller, states } = setup(async () => {
      throw error;
    });
    await controller.start();
    assert.equal(states.at(-1).mode, expectedMode);
    assert.ok(states.at(-1).message);
  }
});
