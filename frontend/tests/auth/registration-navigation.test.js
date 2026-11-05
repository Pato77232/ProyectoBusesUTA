import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loginPath,
  readReservationReturn,
  safeReservationReturn,
  saveRegistrationEmail,
  takeRegistrationEmail,
} from "../../src/auth/registration-navigation.js";

test("conserva solo el retorno interno de reservas con contexto válido", () => {
  const next =
    "/pages/reservas.html?tripId=viaje-1&fromPosition=0&toPosition=2";
  assert.equal(
    readReservationReturn("?" + new URLSearchParams({ next })),
    next,
  );
  assert.equal(
    readReservationReturn(new URL(loginPath(next), "http://qa.invalid").search),
    next,
  );
  assert.equal(
    safeReservationReturn("/pages/reservas.html"),
    "/pages/reservas.html",
  );
  for (const value of [
    "https://evil.invalid/pages/reservas.html",
    "//evil.invalid/pages/reservas.html",
    "/pages/reservas.html#fragmento",
    "/pages/reservas.html?tripId=x&fromPosition=2&toPosition=1",
    "/pages/reservas.html?tripId=x&fromPosition=0&toPosition=1&extra=1",
  ])
    assert.equal(safeReservationReturn(value), null);
});

test("el correo se consume una sola vez y nunca aparece en la ruta de login", () => {
  const values = new Map();
  const storage = {
    setItem: (key, value) => values.set(key, value),
    getItem: (key) => values.get(key),
    removeItem: (key) => values.delete(key),
  };
  saveRegistrationEmail(storage, "cliente@qa.invalid");
  assert.equal(takeRegistrationEmail(storage), "cliente@qa.invalid");
  assert.equal(takeRegistrationEmail(storage), null);
  assert.equal(loginPath(null), "/pages/login.html");
});
