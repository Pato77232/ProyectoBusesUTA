const createViewOwnerTickets = require('../../../src/modules/tickets/application/view-owner-tickets');
const createSvgQrRenderer = require('../../../src/modules/tickets/infrastructure/svg-qr-renderer');
const createTicketRouter = require('../../../src/modules/tickets/interfaces/ticket-router');

const payload = `TRANSVIAJE:TICKET:${'A'.repeat(26)}`;
const sheet = Object.freeze({
  bookingId: 'venta',
  tickets: Object.freeze([
    Object.freeze({ ticketId: 't-1', code: 'A'.repeat(26), qrPayload: payload }),
  ]),
});

test('agrega el SVG del QR a cada boleto a partir de qrPayload', async () => {
  const qrRenderer = { render: jest.fn(async () => '<svg viewBox="0 0 1 1"></svg>') };
  const view = createViewOwnerTickets({ issueOwnerTickets: async () => sheet, qrRenderer });
  const result = await view({ bookingId: 'venta', ownerId: 'o' });
  expect(qrRenderer.render).toHaveBeenCalledWith(payload);
  expect(result.tickets[0]).toMatchObject({
    ticketId: 't-1',
    qrSvg: '<svg viewBox="0 0 1 1"></svg>',
  });
  expect(Object.isFrozen(result.tickets[0])).toBe(true);
});

test.each([
  ['falla al dibujar', jest.fn().mockRejectedValue(new Error('detalle'))],
  ['no devuelve SVG', jest.fn().mockResolvedValue('<html></html>')],
  ['devuelve vacío', jest.fn().mockResolvedValue('')],
])('si el QR %s, falla completo con error de integridad', async (_label, render) => {
  const view = createViewOwnerTickets({
    issueOwnerTickets: async () => sheet,
    qrRenderer: { render },
  });
  await expect(view({})).rejects.toMatchObject({ code: 'TICKET_INTEGRITY_ERROR', httpStatus: 500 });
});

test('propaga los errores de emisión sin dibujar QR', async () => {
  const render = jest.fn();
  const error = Object.assign(new Error('x'), { code: 'TICKET_NOT_FOUND', httpStatus: 404 });
  const view = createViewOwnerTickets({
    issueOwnerTickets: async () => {
      throw error;
    },
    qrRenderer: { render },
  });
  await expect(view({})).rejects.toBe(error);
  expect(render).not.toHaveBeenCalled();
});

test('el renderizador usa la biblioteca qrcode con salida SVG', async () => {
  const library = { toString: jest.fn(async () => '<svg/>') };
  await createSvgQrRenderer({ library }).render(payload);
  expect(library.toString).toHaveBeenCalledWith(payload, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
  });
  await expect(createSvgQrRenderer().render(payload)).resolves.toMatch(/^<svg[\s>]/);
});

test('el router exige CUSTOMER y toma el propietario de la sesión, no de la petición', async () => {
  const authorize = jest.fn(() => (req, res, next) => next());
  const auth = {
    authenticate: (req, res, next) => {
      req.auth = { user: { id: 'cliente-de-sesion' } };
      next();
    },
    authorize,
  };
  const viewOwnerTickets = jest.fn(async () => ({ tickets: [] }));
  const router = createTicketRouter({ auth, viewOwnerTickets });
  expect(authorize).toHaveBeenCalledWith('CUSTOMER');
  const express = require('express');
  const app = express().use('/t', router);
  const http = require('node:http');
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/t/bookings/venta-1?ownerId=intruso`,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(viewOwnerTickets).toHaveBeenCalledWith({
      bookingId: 'venta-1',
      ownerId: 'cliente-de-sesion',
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
