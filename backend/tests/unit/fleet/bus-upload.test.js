const { Readable } = require('node:stream');
const {
  readBusMultipart,
  MAX_DATA_BYTES,
  MAX_REQUEST_BYTES,
} = require('../../../src/modules/fleet/interfaces/read-bus-multipart');
const validatePhotos = require('../../../src/modules/fleet/interfaces/validate-bus-photos');
const { multipart, image, parts, contentType } = require('../../helpers/fleet-upload');

let png, jpeg;
beforeAll(async () => {
  png = await image();
  jpeg = await image('jpeg');
});

function parse(bytes, headers = {}) {
  const req = Readable.from(
    Array.from({ length: Math.ceil(bytes.length / 16_384) }, (_, index) =>
      bytes.subarray(index * 16_384, (index + 1) * 16_384),
    ),
  );
  req.headers = { 'content-type': contentType, ...headers };
  return readBusMultipart(req);
}

test('recupera data y fotografías en orden con lectura fragmentada', async () => {
  const input = parts({ plate: 'TBM-0013' }, png);
  input.push({ name: 'photos', filename: 'foto.jpeg', contentType: 'image/jpeg', value: jpeg });
  const result = await parse(multipart(input));
  expect(result.data).toEqual({ plate: 'TBM-0013' });
  expect(result.photos.map((photo) => photo.bytes)).toEqual([png, jpeg]);
  expect(await validatePhotos(result.photos)).toEqual([
    { bytes: png, contentType: 'image/png' },
    { bytes: jpeg, contentType: 'image/jpeg' },
  ]);
});

test.each([0, 11])('rechaza %s fotos', async (count) => {
  const input = [
    { name: 'data', value: '{}' },
    ...Array.from({ length: count }, () => parts({}, png)[1]),
  ];
  await expect(parse(multipart(input))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
});

test('acepta diez fotos de exactamente 5MB: suma exacta de 50MB', async () => {
  const bytes = Buffer.alloc(5_000_000);
  const input = [
    { name: 'data', value: '{}' },
    ...Array.from({ length: 10 }, () => ({ ...parts({}, bytes)[1] })),
  ];
  const result = await parse(multipart(input));
  expect(result.photos).toHaveLength(10);
  expect(result.photos.reduce((sum, photo) => sum + photo.bytes.length, 0)).toBe(50_000_000);
});

test('un byte más en archivo responde 413 mientras lee, sin necesitar Content-Length', async () => {
  await expect(parse(multipart(parts({}, Buffer.alloc(5_000_001))))).rejects.toMatchObject({
    code: 'PAYLOAD_TOO_LARGE',
    httpStatus: 413,
  });
});

test.each([0, 1])('metadata: límite exacto y un byte más (%s)', async (excess) => {
  const value = JSON.stringify({ text: '' });
  const data = JSON.stringify({
    text: 'a'.repeat(MAX_DATA_BYTES - Buffer.byteLength(value) + excess),
  });
  const attempt = parse(multipart([{ name: 'data', value: data }, parts({}, png)[1]]));
  if (excess) await expect(attempt).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  else expect((await attempt).data.text.length).toBe(MAX_DATA_BYTES - Buffer.byteLength(value));
});

test.each([0, 1])(
  'petición completa: límite exacto y un byte más (%s), sin Content-Length',
  async (excess) => {
    const body = multipart(parts({}, png));
    const input = Buffer.concat([body, Buffer.alloc(MAX_REQUEST_BYTES - body.length + excess, 32)]);
    const attempt = parse(input);
    if (excess) await expect(attempt).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
    else expect((await attempt).photos[0].bytes).toEqual(png);
  },
);

test.each([
  ['data repetido', () => [...parts({}, png), { name: 'data', value: '{}' }]],
  ['campo adicional', () => [...parts({}, png), { name: 'cooperative_id', value: 'ajena' }]],
  ['archivo con otro campo', () => [{ ...parts({}, png)[1], name: 'other' }, parts({}, png)[0]]],
  ['foto vacía', () => parts({}, Buffer.alloc(0))],
  ['data ausente', () => [parts({}, png)[1]]],
  ['JSON inválido', () => [{ name: 'data', value: '{' }, parts({}, png)[1]]],
  ['JSON array', () => parts([], png)],
  ['JSON null', () => parts(null, png)],
])('rechaza %s', async (name, factory) => {
  await expect(parse(multipart(factory()))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
});

test('rechaza cierre multipart truncado y boundary ausente', async () => {
  const body = multipart(parts({}, png));
  await expect(parse(body.subarray(0, body.length - 15))).rejects.toMatchObject({
    code: 'VALIDATION_ERROR',
  });
  await expect(parse(body, { 'content-type': 'multipart/form-data' })).rejects.toMatchObject({
    code: 'VALIDATION_ERROR',
  });
});

test('tipo no multipart es 415 y Content-Length excesivo se rechaza sin consumir', async () => {
  const req = { headers: { 'content-type': 'application/json' } };
  await expect(readBusMultipart(req)).rejects.toMatchObject({ httpStatus: 415 });
  req.headers = { 'content-type': contentType, 'content-length': String(MAX_REQUEST_BYTES + 1) };
  await expect(readBusMultipart(req)).rejects.toMatchObject({ httpStatus: 413 });
});

test('aborto durante carga rechaza sin resolver un alta parcial', async () => {
  const req = new Readable({ read() {} });
  req.headers = { 'content-type': contentType };
  const attempt = readBusMultipart(req);
  req.push(multipart(parts({}, png)).subarray(0, 50));
  req.emit('aborted');
  await expect(attempt).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  req.destroy();
});

test.each(['png', 'jpeg'])('decodifica %s y rechaza el mismo archivo truncado', async (format) => {
  const bytes = format === 'png' ? png : jpeg;
  const photo = { bytes, contentType: `image/${format}`, originalName: `bus.${format}` };
  await expect(validatePhotos([photo])).resolves.toEqual([
    { bytes, contentType: photo.contentType },
  ]);
  await expect(
    validatePhotos([{ ...photo, bytes: bytes.subarray(0, Math.floor(bytes.length / 2)) }]),
  ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
});

test.each([
  ['png', 1],
  ['png', 2],
  ['png', 8],
  ['jpeg', 1],
  ['jpeg', 2],
  ['jpeg', 8],
])(
  'rechaza truncamiento mínimo de %s por %s bytes aunque conserve datos de píxeles',
  async (format, cut) => {
    const bytes = format === 'png' ? png : jpeg;
    await expect(
      validatePhotos([
        {
          originalName: `bus.${format}`,
          contentType: `image/${format}`,
          bytes: bytes.subarray(0, bytes.length - cut),
        },
      ]),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  },
);

test.each([
  ['nombre.exe', 'image/png', 'png'],
  ['foto.jpg', 'image/png', 'png'],
  ['foto.png', 'image/png', 'jpeg'],
  ['foto.png', 'application/octet-stream', 'png'],
  ['foto.png', 'image/png', 'fake'],
])('rechaza extensión/MIME/contenido incompatible %s %s %s', async (originalName, mime, format) => {
  const bytes = format === 'png' ? png : format === 'jpeg' ? jpeg : Buffer.from('imagen falsa');
  await expect(validatePhotos([{ originalName, contentType: mime, bytes }])).rejects.toMatchObject({
    code: 'VALIDATION_ERROR',
  });
});
