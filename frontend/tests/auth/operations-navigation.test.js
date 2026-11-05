import test from "node:test";
import assert from "node:assert/strict";
import { loginDestination } from "../../src/auth/login-view.js";

test("el inicio ofrece operaciones al administrador de cooperativa", () => {
  assert.deepEqual(loginDestination("COOPERATIVE_ADMIN"), {
    href: "/pages/operaciones-cooperativa.html",
    label: "Operaciones de cooperativa",
  });
});

test("el inicio conserva administración global y no agrega accesos a otros roles", () => {
  assert.deepEqual(loginDestination("SYSTEM_ADMIN"), {
    href: "/pages/cooperativas.html",
    label: "Administrar cooperativas",
  });
  assert.equal(loginDestination("CUSTOMER"), null);
});
