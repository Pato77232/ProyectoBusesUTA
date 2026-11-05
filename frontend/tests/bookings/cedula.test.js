import test from "node:test";
import assert from "node:assert/strict";
import { cedulaProblem } from "../../src/bookings/cedula.js";

test("acepta cédulas con dígito verificador correcto", () => {
  for (const cedula of ["1710034065", "0100000009", " 1710034065 "])
    assert.equal(cedulaProblem(cedula), null);
});

test("explica si faltan dígitos o si el verificador no coincide", () => {
  assert.match(cedulaProblem("12345"), /10 dígitos/);
  assert.match(cedulaProblem("0000000000"), /10 dígitos/);
  assert.match(cedulaProblem(undefined), /10 dígitos/);
  assert.match(cedulaProblem("1710034066"), /no es válida/);
});
