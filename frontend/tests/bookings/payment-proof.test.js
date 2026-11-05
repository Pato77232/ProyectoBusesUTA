import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PROOF_BYTES,
  isUploadedProof,
  proofFormData,
  proofMessage,
  validateProofFile,
} from "../../src/bookings/payment-proof.js";

const file = (type, size, name = "comprobante") =>
  new globalThis.File([new Uint8Array(size)], name, { type });

test("acepta JPG, PNG y PDF dentro del límite", () => {
  for (const type of ["image/jpeg", "image/png", "application/pdf"])
    assert.equal(validateProofFile(file(type, 10)), null);
  assert.equal(validateProofFile(file("image/png", MAX_PROOF_BYTES)), null);
});

test("explica por qué rechaza el archivo antes de enviarlo", () => {
  assert.match(validateProofFile(undefined), /Elige el archivo/);
  assert.match(validateProofFile(file("image/gif", 10)), /JPG o PNG, o un PDF/);
  assert.match(validateProofFile(file("image/png", 0)), /vacío/);
  assert.match(
    validateProofFile(file("image/png", MAX_PROOF_BYTES + 1)),
    /supera 5 MB/,
  );
});

test("arma el formulario multipart con los campos de PAGOS-01", () => {
  const form = proofFormData("reserva-1", file("image/png", 3, "pago.png"));
  assert.deepEqual([...form.keys()], ["bookingId", "file"]);
  assert.equal(form.get("bookingId"), "reserva-1");
  assert.equal(form.get("file").name, "pago.png");
});

test("traduce los rechazos conocidos y deja una salida segura ante la duda", () => {
  assert.match(
    proofMessage({ status: 409, code: "PAYMENT_PROOF_ALREADY_UPLOADED" }),
    /Ya recibimos/,
  );
  assert.match(
    proofMessage({
      status: 409,
      code: "PAYMENT_PROOF_UPLOAD_DEADLINE_EXPIRED",
    }),
    /plazo/,
  );
  assert.match(proofMessage({ status: 413 }), /tamaño permitido/);
  assert.match(proofMessage({ code: "NETWORK_ERROR" }), /Actualizar estado/);
  assert.match(
    proofMessage({ status: 500, code: "PAYMENT_PROOF_PERSISTENCE_UNCERTAIN" }),
    /Actualizar estado/,
  );
  assert.match(proofMessage({ status: 400, code: "OTRO" }), /Inténtalo/);
});

test("solo confirma la carga con un comprobante identificado", () => {
  assert.equal(
    isUploadedProof({ paymentProof: { id: "p-1", status: "UPLOADED" } }),
    true,
  );
  assert.equal(isUploadedProof({ paymentProof: { id: "" } }), false);
  assert.equal(isUploadedProof(undefined), false);
});
