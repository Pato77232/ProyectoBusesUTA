const {
  parseMultipartBody,
  MultipartRequestError,
} = require('../../../src/modules/payments/interfaces/http/payment-proof-multipart');

const BOUNDARY = 'payment-proof-boundary';
const BOOKING_ID = 'a80a2c4d-8aa8-4a1f-b7b0-e8d0f002bc42';
const PNG_CONTENT = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);

function part(headers, content) {
  return Buffer.concat([
    Buffer.from(`--${BOUNDARY}\r\n${headers}\r\n\r\n`),
    Buffer.isBuffer(content) ? content : Buffer.from(content),
    Buffer.from('\r\n'),
  ]);
}

function form(parts) {
  return Buffer.concat([...parts, Buffer.from(`--${BOUNDARY}--\r\n`)]);
}

test('extrae bookingId y archivo sin alterar los bytes', () => {
  // Arrange
  const body = form([
    part('Content-Disposition: form-data; name="bookingId"', BOOKING_ID),
    part(
      'Content-Disposition: form-data; name="file"; filename="comprobante.png"\r\nContent-Type: image/png',
      PNG_CONTENT,
    ),
  ]);

  // Act
  const result = parseMultipartBody(body, BOUNDARY);

  // Assert
  expect(result.bookingId).toBe(BOOKING_ID);
  expect(result.file).toEqual({ buffer: PNG_CONTENT, originalFileName: 'comprobante.png' });
});

test.each([
  [
    'campo duplicado',
    form([
      part('Content-Disposition: form-data; name="bookingId"', BOOKING_ID),
      part('Content-Disposition: form-data; name="bookingId"', BOOKING_ID),
      part('Content-Disposition: form-data; name="file"; filename="proof.png"', PNG_CONTENT),
    ]),
  ],
  [
    'campo inesperado',
    form([
      part('Content-Disposition: form-data; name="bookingId"', BOOKING_ID),
      part('Content-Disposition: form-data; name="cooperativeId"', 'coop-1'),
      part('Content-Disposition: form-data; name="file"; filename="proof.png"', PNG_CONTENT),
    ]),
  ],
  [
    'bookingId que no es UUID',
    form([
      part('Content-Disposition: form-data; name="bookingId"', 'booking-no-valido'),
      part('Content-Disposition: form-data; name="file"; filename="proof.png"', PNG_CONTENT),
    ]),
  ],
  [
    'archivo sobre 5 MiB',
    form([
      part('Content-Disposition: form-data; name="bookingId"', BOOKING_ID),
      part(
        'Content-Disposition: form-data; name="file"; filename="proof.png"',
        Buffer.alloc(5 * 1024 * 1024 + 1),
      ),
    ]),
  ],
])('rechaza %s', (description, body) => {
  // Act / Assert
  expect(() => parseMultipartBody(body, BOUNDARY)).toThrow(MultipartRequestError);
});
