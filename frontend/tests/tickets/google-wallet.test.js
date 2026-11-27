import test from "node:test";
import assert from "node:assert/strict";
import {
  createGoogleWalletAction,
  walletLinkPath,
  walletMessage,
} from "../../src/tickets/google-wallet.js";

const SAVE = "https://pay.google.com/gp/v/save/abc.def.ghi";

function setup(responses) {
  const calls = [];
  const left = [];
  const client = {
    async request(path) {
      calls.push(path);
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return next;
    },
  };
  return {
    calls,
    left,
    action: createGoogleWalletAction({
      client,
      leave: (url) => left.push(url),
    }),
  };
}

test("el botón solo se ofrece si el servidor dice que está habilitado", async () => {
  assert.equal(await setup([{ enabled: true }]).action.enabled(), true);
  assert.equal(await setup([{ enabled: false }]).action.enabled(), false);
  assert.equal(await setup([new Error("red")]).action.enabled(), false);
  assert.equal(await setup([{}]).action.enabled(), false);
});

test("pide el enlace del boleto y abre Google Wallet", async () => {
  const { calls, left, action } = setup([{ saveUrl: SAVE }]);
  assert.deepEqual(await action.open("reserva/1", "t 1"), {
    ok: true,
    message: null,
  });
  assert.deepEqual(calls, [
    "/api/v1/tickets/bookings/reserva%2F1/tickets/t%201/google-wallet",
  ]);
  assert.deepEqual(left, [SAVE]);
});

test("no abre un enlace que no sea de Google Wallet", async () => {
  const { left, action } = setup([{ saveUrl: "https://otro.example/save" }]);
  const result = await action.open("r", "t");
  assert.equal(result.ok, false);
  assert.match(result.message, /No se pudo preparar/);
  assert.deepEqual(left, []);
});

test("explica cada error sin abrir nada", async () => {
  for (const [status, pattern] of [
    [503, /no está disponible/],
    [404, /No encontramos/],
    [401, /sesión terminó/],
    [500, /No se pudo preparar/],
  ]) {
    const { left, action } = setup([Object.assign(new Error(), { status })]);
    const result = await action.open("r", "t");
    assert.equal(result.ok, false);
    assert.match(result.message, pattern);
    assert.deepEqual(left, []);
  }
  assert.match(walletMessage(undefined), /No se pudo preparar/);
});

test("ignora un segundo clic mientras prepara el pase", async () => {
  let release;
  const calls = [];
  const action = createGoogleWalletAction({
    client: {
      request(path) {
        calls.push(path);
        return new Promise(
          (resolve) => (release = () => resolve({ saveUrl: SAVE })),
        );
      },
    },
    leave() {},
  });
  const first = action.open("r", "t");
  assert.deepEqual(await action.open("r", "t"), { ok: false, message: null });
  release();
  assert.equal((await first).ok, true);
  assert.equal(calls.length, 1);
  assert.equal(
    walletLinkPath("a", "b"),
    "/api/v1/tickets/bookings/a/tickets/b/google-wallet",
  );
});
