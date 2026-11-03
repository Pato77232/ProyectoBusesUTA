const path = require('node:path');
const sharp = require('sharp');
const BusUploadError = require('./bus-upload-error');
// Chunk IEND completo (longitud cero, tipo y CRC definidos por PNG).
const PNG_END = Buffer.from('0000000049454e44ae426082', 'hex');

async function validateBusPhotos(photos) {
  const validated = [];
  // Decodificar secuencialmente: no multiplicar el uso de memoria por diez imágenes.
  for (const photo of photos) {
    const extension = path.extname(photo.originalName || '').toLowerCase();
    const expected =
      extension === '.png' ? 'png' : ['.jpg', '.jpeg'].includes(extension) ? 'jpeg' : null;
    if (!expected || photo.contentType !== `image/${expected}`) throw new BusUploadError();
    // libpng puede tolerar IEND truncado tras decodificar los píxeles; exigir cierre completo.
    if (expected === 'png' && !photo.bytes.subarray(-PNG_END.length).equals(PNG_END))
      throw new BusUploadError();
    try {
      const image = sharp(photo.bytes, { failOn: 'warning' });
      const metadata = await image.metadata();
      if (metadata.format !== expected) throw new Error('Formato incompatible.');
      // metadata por sí sola no detecta una imagen truncada: stats fuerza decodificación.
      await image.stats();
    } catch {
      throw new BusUploadError();
    }
    validated.push({ bytes: photo.bytes, contentType: photo.contentType });
  }
  return validated;
}

module.exports = validateBusPhotos;
