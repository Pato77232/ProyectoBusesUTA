const randomTicketCode = require('../../../src/modules/tickets/infrastructure/random-ticket-code');
const { qrPayload } = require('../../../src/modules/tickets/domain/ticket-code');

test('codifica en base32 RFC 4648 sin relleno', () => {
  expect(randomTicketCode(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
  expect(randomTicketCode(Buffer.alloc(16))).toBe('A'.repeat(26));
  expect(randomTicketCode(Buffer.alloc(16, 0xff))).toBe('7'.repeat(25) + '4');
});

test('genera códigos de 26 caracteres válidos para el QR y distintos entre sí', () => {
  const codes = Array.from({ length: 200 }, () => randomTicketCode());
  for (const code of codes) expect(() => qrPayload(code)).not.toThrow();
  expect(new Set(codes).size).toBe(codes.length);
});
