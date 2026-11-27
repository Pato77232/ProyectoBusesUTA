import test from "node:test";
import assert from "node:assert/strict";
import { loginDestination } from "../../src/auth/login-view.js";

test("el inicio ofrece operaciones al administrador de cooperativa", () => {
  assert.deepEqual(loginDestination("COOPERATIVE_ADMIN"), {
    href: "/pages/operaciones-cooperativa.html",
    label: "Operaciones de cooperativa",
  });
});

test("el inicio conserva administración global y no agrega accesos a roles desconocidos", () => {
  assert.deepEqual(loginDestination("SYSTEM_ADMIN"), {
    href: "/pages/cooperativas.html",
    label: "Administrar cooperativas",
  });
  assert.equal(loginDestination("DRIVER"), null);
  assert.equal(loginDestination(undefined), null);
});

// FRONT-02 T9: cliente y oficinista también tienen punto de entrada.
test("el inicio lleva al cliente a su panel y al oficinista a sus comprobantes", () => {
  assert.deepEqual(loginDestination("CUSTOMER"), {
    href: "/pages/mi-cuenta.html",
    label: "Mi cuenta",
    withActiveSession: true,
  });
  assert.deepEqual(loginDestination("CLERK"), {
    href: "/pages/comprobantes.html",
    label: "Comprobantes pendientes",
  });
});
