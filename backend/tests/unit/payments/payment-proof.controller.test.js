const createPaymentProofController = require('../../../src/modules/payments/interfaces/http/payment-proof.controller');

function responseDouble() {
  return {
    headers: {},
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
}

test('lista solo metadatos permitidos y usa tenant autenticado y cursor solicitado', async () => {
  const listPendingPaymentProofs = {
    execute: jest.fn().mockResolvedValue({
      items: [
        {
          id: 'proof-1',
          booking_id: 'booking-1',
          cooperative_id: 'cooperative-1',
          status: 'UPLOADED',
          file_key: 'private-key',
          original_file_name: 'recibo.pdf',
          media_type: 'application/pdf',
          file_size_bytes: 42,
          uploaded_at: new Date('2026-10-29T12:00:00.000Z'),
        },
      ],
      nextCursor: 'next',
    }),
  };
  const controller = createPaymentProofController({ listPendingPaymentProofs });
  const response = responseDouble();

  await controller.listPending(
    { auth: { user: { cooperative_id: 'cooperative-1' } }, query: { cursor: 'previous' } },
    response,
    jest.fn(),
  );

  expect(listPendingPaymentProofs.execute).toHaveBeenCalledWith({
    cooperativeId: 'cooperative-1',
    cursor: 'previous',
  });
  expect(response.body.items[0]).not.toHaveProperty('file_key');
  expect(response.body.items[0]).not.toHaveProperty('cooperative_id');
  expect(response.body.nextCursor).toBe('next');
});

test('transmite el archivo privado sin ruta y con cabeceras de contenido seguro', async () => {
  const file = {
    content: Buffer.from('%PDF'),
    mediaType: 'application/pdf',
    originalFileName: "recibo's.pdf",
  };
  const readPaymentProofFile = { execute: jest.fn().mockResolvedValue(file) };
  const controller = createPaymentProofController({ readPaymentProofFile });
  const response = responseDouble();

  await controller.readFile(
    {
      auth: { user: { cooperative_id: 'cooperative-1' } },
      params: { paymentProofId: 'proof-1' },
    },
    response,
    jest.fn(),
  );

  expect(response.headers).toEqual({
    'Content-Type': 'application/pdf',
    'Content-Disposition': "inline; filename*=UTF-8''recibo%27s.pdf",
    'X-Content-Type-Options': 'nosniff',
  });
  expect(response.body).toEqual(file.content);
});

test('aprueba con el usuario y cooperativa verificados, sin aceptar identidad del body', async () => {
  const approvePaymentProof = {
    execute: jest.fn().mockResolvedValue({
      id: 'proof-1',
      approved_at: new Date('2026-10-29T12:00:00.000Z'),
    }),
  };
  const controller = createPaymentProofController({
    approvePaymentProof,
    clock: () => new Date('2026-10-29T12:00:00.000Z'),
  });
  const response = responseDouble();

  await controller.approve(
    {
      auth: { user: { id: 'clerk-1', cooperative_id: 'cooperative-1' } },
      params: { paymentProofId: 'proof-1' },
      body: { cooperativeId: 'other-cooperative', approverId: 'spoofed-clerk' },
    },
    response,
    jest.fn(),
  );

  expect(approvePaymentProof.execute).toHaveBeenCalledWith({
    paymentProofId: 'proof-1',
    cooperativeId: 'cooperative-1',
    approverId: 'clerk-1',
    now: new Date('2026-10-29T12:00:00.000Z'),
  });
  expect(response.body.paymentProof).toEqual({
    id: 'proof-1',
    decision: 'APPROVED',
    approvedAt: new Date('2026-10-29T12:00:00.000Z'),
  });
});
