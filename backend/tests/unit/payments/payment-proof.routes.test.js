const { once } = require('node:events');
const createApp = require('../../../src/app');
const createPaymentProofRouter = require('../../../src/modules/payments/interfaces/http/payment-proof.routes');
const BOOKING_ID = 'a80a2c4d-8aa8-4a1f-b7b0-e8d0f002bc42';

describe('POST /api/v1/payment-proofs', () => {
  let server;
  let baseUrl;
  let uploadPaymentProof;
  let listPendingPaymentProofs;
  let readPaymentProofFile;
  let approvePaymentProof;
  let middlewareCalls;

  beforeAll(async () => {
    uploadPaymentProof = {
      execute: jest.fn(async () => ({
        paymentProof: { id: 'proof-1', status: 'UPLOADED', file_key: 'private-key' },
        expiresAt: new Date('2026-10-25T12:05:00.000Z'),
        total: 2550,
      })),
    };
    listPendingPaymentProofs = {
      execute: jest.fn(async () => ({
        items: [
          {
            id: 'proof-1',
            booking_id: BOOKING_ID,
            total_cents: 2550,
            status: 'UPLOADED',
            file_key: 'private-key',
            original_file_name: 'transferencia.pdf',
            media_type: 'application/pdf',
            file_size_bytes: 8,
            uploaded_at: new Date('2026-10-25T12:00:00.000Z'),
          },
        ],
        nextCursor: 'opaque-cursor',
      })),
    };
    readPaymentProofFile = {
      execute: jest.fn(async () => ({
        content: Buffer.from('%PDF'),
        mediaType: 'application/pdf',
        originalFileName: 'transferencia.pdf',
      })),
    };
    approvePaymentProof = {
      execute: jest.fn(async () => ({
        id: 'proof-1',
        approved_at: new Date('2026-10-25T12:00:00.000Z'),
      })),
    };
    middlewareCalls = [];
    const auth = {
      authenticate(request, response, next) {
        middlewareCalls.push('authenticate');
        request.auth = {
          user: {
            id: request.get('X-Test-Role') === 'CLERK' ? 'clerk-1' : 'customer-1',
            role: request.get('X-Test-Role') || 'CUSTOMER',
            cooperative_id: 'cooperative-1',
          },
        };
        next();
      },
      authorize(role) {
        return (request, response, next) => {
          middlewareCalls.push(`authorize:${role}`);
          if (request.auth.user.role !== role) {
            return response
              .status(403)
              .json({ error: { code: 'FORBIDDEN', message: 'No permitido.' } });
          }
          next();
        };
      },
      csrfProtection(request, response, next) {
        middlewareCalls.push('csrfProtection');
        if (request.get('X-CSRF-Token') !== 'valid') {
          return response.status(403).json({
            error: { code: 'CSRF_TOKEN_INVALID', message: 'Token CSRF inválido.' },
          });
        }
        next();
      },
    };
    const payments = {
      router: createPaymentProofRouter({
        auth,
        uploadPaymentProof,
        listPendingPaymentProofs,
        readPaymentProofFile,
        approvePaymentProof,
      }),
    };
    const app = createApp({ payments });
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    server.close();
    await once(server, 'close');
  });

  beforeEach(() => {
    middlewareCalls.length = 0;
    uploadPaymentProof.execute.mockClear();
    listPendingPaymentProofs.execute.mockClear();
    readPaymentProofFile.execute.mockClear();
    approvePaymentProof.execute.mockClear();
  });

  test('autentica, autoriza CUSTOMER, valida CSRF y responde sin exponer la clave privada', async () => {
    // Arrange
    const form = new globalThis.FormData();
    form.set('bookingId', BOOKING_ID);
    form.set(
      'file',
      new globalThis.Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], {
        type: 'image/png',
      }),
      'comprobante.png',
    );

    // Act
    const response = await fetch(`${baseUrl}/api/v1/payment-proofs`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': 'valid' },
      body: form,
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(201);
    expect(body).toEqual({
      paymentProof: {
        id: 'proof-1',
        status: 'UPLOADED',
        expiresAt: '2026-10-25T12:05:00.000Z',
      },
    });
    expect(JSON.stringify(body)).not.toContain('private-key');
    expect(middlewareCalls).toEqual(['authenticate', 'authorize:CUSTOMER', 'csrfProtection']);
    expect(uploadPaymentProof.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: BOOKING_ID,
        authContext: {
          userId: 'customer-1',
          role: 'CUSTOMER',
          cooperativeId: 'cooperative-1',
        },
        file: expect.objectContaining({ originalFileName: 'comprobante.png' }),
        now: expect.any(Date),
      }),
    );
  });

  test('rechaza roles distintos de CUSTOMER antes de leer el formulario', async () => {
    // Act
    const response = await fetch(`${baseUrl}/api/v1/payment-proofs`, {
      method: 'POST',
      headers: { 'X-Test-Role': 'CLERK' },
      body: 'no es multipart',
    });

    // Assert
    expect(response.status).toBe(403);
    expect(middlewareCalls).toEqual(['authenticate', 'authorize:CUSTOMER']);
    expect(uploadPaymentProof.execute).not.toHaveBeenCalled();
  });

  test('rechaza solicitudes sin CSRF antes de leer el formulario', async () => {
    // Act
    const response = await fetch(`${baseUrl}/api/v1/payment-proofs`, {
      method: 'POST',
      body: 'no es multipart',
    });

    // Assert
    expect(response.status).toBe(403);
    expect(middlewareCalls).toEqual(['authenticate', 'authorize:CUSTOMER', 'csrfProtection']);
    expect(uploadPaymentProof.execute).not.toHaveBeenCalled();
  });

  test('lista la bandeja autenticada usando la cooperativa verificada', async () => {
    const response = await fetch(`${baseUrl}/api/v1/payment-proofs?cursor=opaque-cursor`, {
      headers: { 'X-Test-Role': 'CLERK' },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items[0]).toEqual(
      expect.objectContaining({
        id: 'proof-1',
        bookingId: BOOKING_ID,
        totalCents: 2550,
        currency: 'USD',
        fileName: 'transferencia.pdf',
      }),
    );
    expect(JSON.stringify(body)).not.toContain('private-key');
    expect(listPendingPaymentProofs.execute).toHaveBeenCalledWith({
      cooperativeId: 'cooperative-1',
      cursor: 'opaque-cursor',
    });
    expect(middlewareCalls).toEqual(['authenticate', 'authorize:CLERK']);
  });

  test('lee un archivo solo para CLERK y con disposición privada en línea', async () => {
    const response = await fetch(`${baseUrl}/api/v1/payment-proofs/proof-1/file`, {
      headers: { 'X-Test-Role': 'CLERK' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/pdf');
    expect(response.headers.get('content-disposition')).toContain('inline;');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.from('%PDF'));
    expect(readPaymentProofFile.execute).toHaveBeenCalledWith({
      paymentProofId: 'proof-1',
      cooperativeId: 'cooperative-1',
    });
  });

  test('aprueba con CSRF y conserva la identidad verificada del oficinista', async () => {
    const response = await fetch(`${baseUrl}/api/v1/payment-proofs/proof-1/approve`, {
      method: 'POST',
      headers: { 'X-Test-Role': 'CLERK', 'X-CSRF-Token': 'valid' },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.paymentProof).toEqual({
      id: 'proof-1',
      decision: 'APPROVED',
      approvedAt: '2026-10-25T12:00:00.000Z',
    });
    expect(approvePaymentProof.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentProofId: 'proof-1',
        cooperativeId: 'cooperative-1',
        approverId: 'clerk-1',
        now: expect.any(Date),
      }),
    );
    expect(middlewareCalls).toEqual(['authenticate', 'authorize:CLERK', 'csrfProtection']);
  });
});
