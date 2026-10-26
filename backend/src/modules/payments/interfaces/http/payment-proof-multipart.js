const { MAX_FILE_SIZE_BYTES } = require('../../domain/payment-proof-constraints');
const MAX_MULTIPART_OVERHEAD_BYTES = 64 * 1024;
const MAX_HEADER_BYTES = 8 * 1024;
const CRLF = Buffer.from('\r\n');
const HEADER_SEPARATOR = Buffer.from('\r\n\r\n');
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class MultipartRequestError extends Error {
  constructor(code, httpStatus, message) {
    super(message);
    this.name = 'MultipartRequestError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function invalidMultipart() {
  return new MultipartRequestError(
    'INVALID_MULTIPART_FORM',
    400,
    'El formulario multipart no es válido.',
  );
}

function getBoundary(contentType) {
  if (typeof contentType !== 'string' || !/^multipart\/form-data\s*;/i.test(contentType)) {
    throw new MultipartRequestError(
      'UNSUPPORTED_MEDIA_TYPE',
      415,
      'Se requiere multipart/form-data.',
    );
  }

  const match = /(?:^|;)\s*boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  const boundary = match?.[1] || match?.[2];
  if (!boundary || boundary.length > 70 || !/^[0-9A-Za-z'()+_,./:=?-]+$/.test(boundary)) {
    throw invalidMultipart();
  }
  return boundary;
}

function parseDisposition(headers) {
  const disposition = headers.split('\r\n').find((header) => /^content-disposition:/i.test(header));
  const match =
    disposition &&
    /^content-disposition:\s*form-data;\s*name="([^"\\]+)"(?:;\s*filename="([^"\\]*)")?\s*$/i.exec(
      disposition,
    );
  if (!match) throw invalidMultipart();
  return { name: match[1], fileName: match[2] };
}

function parseMultipartBody(body, boundary) {
  const delimiter = Buffer.from(`\r\n--${boundary}`);
  const opening = Buffer.from(`--${boundary}\r\n`);
  if (!body.subarray(0, opening.length).equals(opening)) throw invalidMultipart();

  const fields = {};
  let cursor = opening.length;
  let completed = false;
  while (!completed) {
    const headerEnd = body.indexOf(HEADER_SEPARATOR, cursor);
    if (headerEnd < cursor || headerEnd - cursor > MAX_HEADER_BYTES) throw invalidMultipart();

    const headers = body.subarray(cursor, headerEnd).toString('latin1');
    const { name, fileName } = parseDisposition(headers);
    const contentStart = headerEnd + HEADER_SEPARATOR.length;
    const partEnd = body.indexOf(delimiter, contentStart);
    if (partEnd < contentStart) throw invalidMultipart();
    const content = body.subarray(contentStart, partEnd);

    if (name === 'bookingId' && fileName === undefined && !Object.hasOwn(fields, name)) {
      fields.bookingId = content.toString('utf8').trim();
      if (!UUID_PATTERN.test(fields.bookingId)) throw invalidMultipart();
    } else if (name === 'file' && typeof fileName === 'string' && !fields.file) {
      if (content.length > MAX_FILE_SIZE_BYTES) {
        throw new MultipartRequestError(
          'PAYMENT_PROOF_TOO_LARGE',
          413,
          'El comprobante supera el tamaño máximo permitido.',
        );
      }
      fields.file = { buffer: content, originalFileName: fileName };
    } else {
      throw invalidMultipart();
    }

    cursor = partEnd + delimiter.length;
    if (body.subarray(cursor, cursor + 2).equals(Buffer.from('--'))) {
      cursor += 2;
      if (body.subarray(cursor, cursor + 2).equals(CRLF)) cursor += 2;
      if (cursor !== body.length) throw invalidMultipart();
      completed = true;
    } else if (body.subarray(cursor, cursor + 2).equals(CRLF)) {
      cursor += 2;
    } else {
      throw invalidMultipart();
    }
  }

  if (!Object.hasOwn(fields, 'bookingId') || !fields.file) throw invalidMultipart();
  return fields;
}

function readRequestBody(request, maximumBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let settled = false;

    request.on('data', (chunk) => {
      if (settled) return;
      totalBytes += chunk.length;
      if (totalBytes > maximumBytes) {
        settled = true;
        reject(
          new MultipartRequestError(
            'PAYMENT_PROOF_TOO_LARGE',
            413,
            'El formulario supera el tamaño máximo permitido.',
          ),
        );
        request.resume();
        return;
      }
      chunks.push(chunk);
    });
    request.once('end', () => {
      if (!settled) resolve(Buffer.concat(chunks));
    });
    request.once('error', (error) => {
      if (!settled) reject(error);
    });
  });
}

function parsePaymentProofMultipart(request, _response, next) {
  let boundary;
  try {
    boundary = getBoundary(request.get('Content-Type'));
  } catch (error) {
    next(error);
    return;
  }

  readRequestBody(request, MAX_FILE_SIZE_BYTES + MAX_MULTIPART_OVERHEAD_BYTES)
    .then((body) => {
      request.paymentProofInput = parseMultipartBody(body, boundary);
      next();
    })
    .catch(next);
}

module.exports = { MultipartRequestError, parseMultipartBody, parsePaymentProofMultipart };
