const Busboy = require('busboy');
const { Transform } = require('node:stream');
const BusUploadError = require('./bus-upload-error');
const { MAX_BUS_PHOTOS, MAX_BUS_PHOTO_BYTES } = require('../domain/bus-photo-references');

const MAX_DATA_BYTES = 32_768;
const MAX_PHOTO_SUM_BYTES = 50_000_000;
const MAX_REQUEST_BYTES = 50_065_536;

function readBusMultipart(req) {
  if (!/^multipart\/form-data(?:;|$)/i.test(req.headers['content-type'] || ''))
    return Promise.reject(new BusUploadError('UNSUPPORTED_MEDIA_TYPE'));
  if (Number(req.headers['content-length']) > MAX_REQUEST_BYTES)
    return Promise.reject(new BusUploadError('PAYLOAD_TOO_LARGE'));
  return new Promise((resolve, reject) => {
    let parser;
    try {
      parser = Busboy({
        headers: req.headers,
        limits: {
          fileSize: MAX_BUS_PHOTO_BYTES + 1,
          fieldSize: MAX_DATA_BYTES + 1,
          files: MAX_BUS_PHOTOS + 1,
          fields: 2,
          parts: MAX_BUS_PHOTOS + 3,
        },
      });
    } catch {
      reject(new BusUploadError());
      return;
    }
    let total = 0,
      photoSum = 0,
      settled = false,
      data;
    const photos = [];
    const counter = new Transform({
      transform(chunk, encoding, callback) {
        total += chunk.length;
        callback(total > MAX_REQUEST_BYTES ? new BusUploadError('PAYLOAD_TOO_LARGE') : null, chunk);
      },
    });
    const detach = () => {
      req.unpipe(counter);
      counter.unpipe(parser);
      req.off('aborted', aborted);
      req.off('error', aborted);
    };
    const fail = (error = new BusUploadError()) => {
      if (settled) return;
      settled = true;
      detach();
      // Salir del callback de Busboy antes de destruir su stream interno de archivo.
      process.nextTick(() => {
        counter.destroy();
        parser.destroy();
      });
      if (!req.destroyed) req.resume();
      reject(error instanceof BusUploadError ? error : new BusUploadError());
    };
    const aborted = () => fail();
    req.once('aborted', aborted);
    req.once('error', aborted);
    counter.on('error', fail);
    parser.on('error', fail);
    for (const event of ['filesLimit', 'fieldsLimit', 'partsLimit']) parser.on(event, () => fail());
    parser.on('field', (name, value, info) => {
      if (info.valueTruncated || Buffer.byteLength(value) > MAX_DATA_BYTES)
        return fail(new BusUploadError('PAYLOAD_TOO_LARGE'));
      if (name !== 'data' || data !== undefined || info.nameTruncated) return fail();
      data = value;
    });
    parser.on('file', (name, file, info) => {
      file.on('error', fail);
      if (name !== 'photos' || photos.length >= MAX_BUS_PHOTOS) {
        file.resume();
        return fail();
      }
      const chunks = [];
      let size = 0;
      const photo = { originalName: info.filename, contentType: info.mimeType };
      photos.push(photo);
      file.on('limit', () => fail(new BusUploadError('PAYLOAD_TOO_LARGE')));
      file.on('data', (chunk) => {
        if (settled) return;
        size += chunk.length;
        photoSum += chunk.length;
        if (size > MAX_BUS_PHOTO_BYTES || photoSum > MAX_PHOTO_SUM_BYTES)
          return fail(new BusUploadError('PAYLOAD_TOO_LARGE'));
        chunks.push(chunk);
      });
      file.on('end', () => {
        if (!settled) photo.bytes = Buffer.concat(chunks, size);
      });
    });
    parser.on('close', () => {
      if (settled) return;
      if (data === undefined || photos.length === 0 || photos.some((photo) => !photo.bytes?.length))
        return fail();
      let metadata;
      try {
        metadata = JSON.parse(data);
      } catch {
        return fail();
      }
      if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return fail();
      settled = true;
      detach();
      resolve({ data: metadata, photos });
    });
    req.pipe(counter).pipe(parser);
  });
}

module.exports = { readBusMultipart, MAX_DATA_BYTES, MAX_PHOTO_SUM_BYTES, MAX_REQUEST_BYTES };
