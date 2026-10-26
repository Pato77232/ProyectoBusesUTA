const { once } = require('node:events');
const createApp = require('../../../src/app');
const createPaymentProofRouter = require('../../../src/modules/payments/interfaces/http/payment-proof.routes');

describe('POST /api/v1/payment-proofs', () => {
  let server;
  let baseUrl;
  let uploadPaymentProof;
  let middlewareCalls;

  beforeAll(async () => {
    uploadPaymentProof = { execute: jest.fn(async () => ({
      paymentProof: { id: 'proof-1', status: 'UPLOADED', file_key: 'private-key' },
      expiresAt: new Date('2026-10-25T12:05:00.000Z'),
      total: 2550,
    })) };
    middlewareCalls = [];
    const auth = {
      authenticate(request, response, next) {
        middlewareCalls.push('authenticate');
        request.auth = {
          user: { id: 'customer-1', role: request.get('X-Test-Role') || 'CUSTOMER' },
        };
        next();
      },
      authorize(role) {
        return (request, response, next) => {
          middlewareCalls.push(`authorize:${role}`);
          if (request.auth.user.role !== role) {
            return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'No permitido.' } });
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
    const payments = { router: createPaymentProofRouter({ auth, uploadPaymentProof }) };
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
  });

  test('autentica, autoriza CUSTOMER, valida CSRF y responde sin exponer la clave privada', async () => {
    // Arrange
    const form = new globalThis.FormData();
    form.set('bookingId', 'booking-1');
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
        bookingId: 'booking-1',
        customerId: 'customer-1',
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
});
