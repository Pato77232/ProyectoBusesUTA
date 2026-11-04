const sharp = require('sharp');
const { crc32 } = require('node:zlib');
const BOUNDARY = 'fleet-test-boundary-111';

function multipart(parts) {
  const chunks = [];
  for (const part of parts) {
    const filename = part.filename === undefined ? '' : `; filename="${part.filename}"`;
    chunks.push(
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${part.name}"${filename}\r\n${part.contentType ? `Content-Type: ${part.contentType}\r\n` : ''}\r\n`,
      ),
    );
    chunks.push(Buffer.isBuffer(part.value) ? part.value : Buffer.from(part.value));
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return Buffer.concat(chunks);
}

async function image(format = 'png') {
  return sharp({ create: { width: 2, height: 2, channels: 3, background: '#ffeeaa' } })
    .toFormat(format)
    .toBuffer();
}

function parts(data, bytes) {
  return [
    { name: 'data', value: JSON.stringify(data) },
    { name: 'photos', filename: 'foto.png', contentType: 'image/png', value: bytes },
  ];
}

function sizedPng(bytes, size) {
  // Chunk auxiliar privado válido: mantener IEND al final y CRC correcto.
  const chunk = Buffer.alloc(size - bytes.length);
  chunk.writeUInt32BE(chunk.length - 12, 0);
  chunk.write('npAD', 4, 'ascii');
  chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4);
  return Buffer.concat([bytes.subarray(0, -12), chunk, bytes.subarray(-12)]);
}

module.exports = {
  multipart,
  image,
  parts,
  sizedPng,
  contentType: `multipart/form-data; boundary=${BOUNDARY}`,
};
