const { createNotificationsModule } = require('../../../src/modules/notifications');
const { emailNotice } = require('../../../src/modules/notifications/domain/email-notice');

const NOW = new Date('2026-11-05T12:00:00.000Z');
const base = { kind: 'TICKETS_READY', bookingId: 'b-1', cooperativeId: 'c-1' };

function harness(rows = [{ id: 'n-1' }]) {
  const client = { query: jest.fn().mockResolvedValue({ rows }) };
  const { outbox } = createNotificationsModule({ clock: () => NOW, newId: () => 'n-1' });
  return { client, outbox };
}

test('encola con el cliente de la transacción y sin datos personales', async () => {
  const h = harness();
  await expect(h.outbox.enqueueWith(h.client, base)).resolves.toEqual({ queued: true });
  const [sql, args] = h.client.query.mock.calls[0];
  expect(sql).toContain('ON CONFLICT (kind, booking_id) DO NOTHING');
  expect(args).toEqual(['n-1', 'TICKETS_READY', 'b-1', 'c-1', {}, NOW]);
});

test('un aviso repetido no se duplica e informa queued false', async () => {
  const h = harness([]);
  await expect(h.outbox.enqueueWith(h.client, base)).resolves.toEqual({ queued: false });
});

test('el rechazo guarda solo la justificación recortada', () => {
  expect(
    emailNotice({ ...base, kind: 'PROOF_REJECTED', justification: '  Monto distinto  ' }),
  ).toEqual({ ...base, kind: 'PROOF_REJECTED', payload: { justification: 'Monto distinto' } });
});

test.each([
  null,
  [],
  {},
  { ...base, kind: 'OTRO' },
  { ...base, bookingId: ' ' },
  { ...base, cooperativeId: 'x'.repeat(201) },
  { ...base, email: 'cliente@example.ec' },
  { ...base, justification: 'no corresponde' },
  { ...base, kind: 'PROOF_REJECTED' },
  { ...base, kind: 'PROOF_REJECTED', justification: '   ' },
  { ...base, kind: 'PROOF_REJECTED', justification: 'x'.repeat(1001) },
])('aviso inválido %j no llega a la base', async (input) => {
  const h = harness();
  await expect(h.outbox.enqueueWith(h.client, input)).rejects.toMatchObject({
    code: 'EMAIL_NOTICE_INVALID',
  });
  expect(h.client.query).not.toHaveBeenCalled();
});

test('sin cliente de transacción no encola', async () => {
  const h = harness();
  await expect(h.outbox.enqueueWith(undefined, base)).rejects.toThrow(TypeError);
});
