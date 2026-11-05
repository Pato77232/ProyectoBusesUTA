import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createDecisionController,
  decisionMessage,
} from '../../src/payments/decision-controller.js';

const ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

function setup(response) {
  const calls = [];
  const events = [];
  const client = {
    async request(path, options) {
      calls.push([path, options]);
      if (response instanceof Error) throw response;
      return typeof response === 'function' ? response() : response;
    },
  };
  const view = new Proxy(
    {},
    {
      get:
        (_, name) =>
        (...args) =>
          events.push([name, ...args]),
    },
  );
  return { calls, events, decisions: createDecisionController({ client, view }) };
}
const apiError = (status, code) => Object.assign(new Error(code), { status, code });
const last = (events, name) => events.filter(([event]) => event === name).at(-1);

test('aprueba solo después de confirmar la revisión del archivo', async () => {
  const { calls, events, decisions } = setup({
    paymentProof: { id: ID, decision: 'APPROVED' },
  });
  assert.equal(await decisions.approve(ID, { reviewed: false }), false);
  assert.equal(calls.length, 0);
  assert.match(last(events, 'failed')[2], /Confirma que revisaste/);
  assert.equal(await decisions.approve(ID, { reviewed: true }), true);
  assert.deepEqual(calls, [[`/api/v1/payment-proofs/${ID}/approve`, { method: 'POST' }]]);
  assert.match(last(events, 'decided')[2], /Pago aprobado/);
});

test('rechaza con el motivo recortado y exige justificación', async () => {
  const { calls, events, decisions } = setup({
    paymentProof: { id: ID, decision: 'REJECTED' },
  });
  assert.equal(await decisions.reject(ID, '   '), false);
  assert.equal(calls.length, 0);
  assert.match(last(events, 'failed')[2], /motivo del rechazo/);
  assert.equal(await decisions.reject(ID, '  Monto distinto  '), true);
  assert.deepEqual(calls[0], [
    `/api/v1/payment-proofs/${ID}/reject`,
    { method: 'POST', data: { justification: 'Monto distinto' } },
  ]);
});

test('no confirma una decisión con una respuesta inesperada', async () => {
  const { events, decisions } = setup({ paymentProof: { id: ID, decision: 'REJECTED' } });
  assert.equal(await decisions.approve(ID, { reviewed: true }), false);
  assert.match(last(events, 'failed')[2], /No pudimos confirmar/);
  assert.equal(last(events, 'decided'), undefined);
});

test('ignora identificadores manipulados', async () => {
  const { calls, decisions } = setup({});
  assert.equal(await decisions.approve('../x', { reviewed: true }), false);
  assert.equal(calls.length, 0);
});

test('evita decisiones simultáneas y libera los controles al terminar', async () => {
  let release;
  const { calls, events, decisions } = setup(() => new Promise((resolve) => (release = resolve)));
  const first = decisions.approve(ID, { reviewed: true });
  assert.equal(await decisions.reject(ID, 'Motivo'), false);
  release({ paymentProof: { id: ID, decision: 'APPROVED' } });
  await first;
  assert.equal(calls.length, 1);
  assert.deepEqual(
    events.filter(([name]) => name === 'busy').map(([, , value]) => value),
    [true, false],
  );
});

test('traduce los errores conocidos y trata la duda como incierta', async () => {
  const { events, decisions } = setup(apiError(409, 'PAYMENT_PROOF_NOT_PENDING'));
  await decisions.approve(ID, { reviewed: true });
  assert.match(last(events, 'failed')[2], /ya fue resuelto/);
  assert.match(decisionMessage(apiError(500, 'X')), /Actualiza la bandeja/);
  assert.match(
    decisionMessage(apiError(409, 'PAYMENT_PROOF_RECONCILIATION_REQUIRED')),
    /Actualiza la bandeja/,
  );
  assert.match(decisionMessage({ code: 'NETWORK_ERROR' }), /No pudimos confirmar/);
  assert.match(decisionMessage(apiError(403, 'FORBIDDEN')), /permiso/);
});
