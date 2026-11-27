import test from "node:test";
import assert from "node:assert/strict";
import {
  sessionLinkFor,
  updateSessionLinks,
} from "../../src/auth/session-link.js";

const link = () => ({ href: "login.html", textContent: "Iniciar sesión" });
const client = (response) => ({
  calls: 0,
  async request() {
    this.calls += 1;
    if (response instanceof Error) throw response;
    return response;
  },
});

test("cada rol conocido recibe el acceso a su panel", () => {
  assert.deepEqual(sessionLinkFor({ email: "c@x.test", role: "CUSTOMER" }), {
    href: "/pages/mi-cuenta.html",
    label: "Mi cuenta",
  });
  assert.equal(
    sessionLinkFor({ email: "o@x.test", role: "CLERK" }).href,
    "/pages/comprobantes.html",
  );
  assert.equal(sessionLinkFor({ email: "x@x.test", role: "DRIVER" }), null);
  assert.equal(sessionLinkFor(null), null);
});

test("con sesión cambia el enlace y oculta lo exclusivo de visitantes", async () => {
  const links = [link(), link()];
  const guest = { hidden: false };
  const target = await updateSessionLinks({
    client: client({ user: { email: "c@x.test", role: "CUSTOMER" } }),
    links,
    guestOnly: [guest],
  });
  assert.equal(target.label, "Mi cuenta");
  assert.ok(links.every((item) => item.href === "/pages/mi-cuenta.html"));
  assert.ok(links.every((item) => item.textContent === "Mi cuenta"));
  assert.equal(guest.hidden, true);
});

test("sin sesión o ante un error conserva «Iniciar sesión»", async () => {
  for (const response of [
    Object.assign(new Error(), { status: 401 }),
    new Error("red"),
    { user: null },
  ]) {
    const links = [link()];
    const guest = { hidden: false };
    assert.equal(
      await updateSessionLinks({
        client: client(response),
        links,
        guestOnly: [guest],
      }),
      null,
    );
    assert.deepEqual(links[0], link());
    assert.equal(guest.hidden, false);
  }
});

test("no consulta la sesión si la página no tiene enlaces que cambiar", async () => {
  const api = client({ user: { email: "c@x.test", role: "CUSTOMER" } });
  assert.equal(await updateSessionLinks({ client: api, links: [] }), null);
  assert.equal(api.calls, 0);
});
