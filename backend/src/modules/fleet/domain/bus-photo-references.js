const { BusRegistrationValidationError } = require('./bus-registration-error');

const MAX_BUS_PHOTOS = 10;
const MAX_BUS_PHOTO_BYTES = 5_000_000;
const PHOTO_CONTENT_TYPES = Object.freeze(['image/jpeg', 'image/png']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELDS = ['fileKey', 'contentType', 'size'];

/** Solo referencias generadas por el servidor; no acredita el contenido de una imagen. */
function createBusPhotoReferences(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_BUS_PHOTOS) {
    throw new BusRegistrationValidationError();
  }
  const seen = new Set();
  return Object.freeze(
    Array.from(input, (photo, order) => {
      if (
        !photo ||
        typeof photo !== 'object' ||
        Array.isArray(photo) ||
        !Object.keys(photo).every((key) => FIELDS.includes(key)) ||
        typeof photo.fileKey !== 'string' ||
        !UUID_PATTERN.test(photo.fileKey) ||
        !PHOTO_CONTENT_TYPES.includes(photo.contentType) ||
        !Number.isSafeInteger(photo.size) ||
        photo.size < 1 ||
        photo.size > MAX_BUS_PHOTO_BYTES
      )
        throw new BusRegistrationValidationError();
      const fileKey = photo.fileKey.toLowerCase();
      if (seen.has(fileKey)) throw new BusRegistrationValidationError();
      seen.add(fileKey);
      return Object.freeze({ fileKey, contentType: photo.contentType, size: photo.size, order });
    }),
  );
}

module.exports = {
  createBusPhotoReferences,
  MAX_BUS_PHOTOS,
  MAX_BUS_PHOTO_BYTES,
  PHOTO_CONTENT_TYPES,
};
