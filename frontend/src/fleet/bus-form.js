// FLEET-05: estas comprobaciones orientan; la validación que decide está en el backend.
export const MAX_BUS_PHOTOS = 10;
export const MAX_BUS_PHOTO_BYTES = 5_000_000;
export const MAX_BUS_PHOTOS_TOTAL_BYTES = 50_000_000;

const BYTES_PER_KB = 1_000;
const BYTES_PER_MB = 1_000_000;
const PLATE_PATTERN = /^[A-Z]{3}-?[0-9]{4}$/;
const UNIT_NUMBER_PATTERN = /^[0-9]+$/;
const PHOTO_TYPES = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
]);

function isBlank(value) {
  return typeof value !== 'string' || value.trim().length === 0;
}

function isPlate(value) {
  return PLATE_PATTERN.test(
    String(value ?? '')
      .trim()
      .toUpperCase(),
  );
}

function isUnitNumber(value) {
  const text = String(value ?? '').trim();
  return UNIT_NUMBER_PATTERN.test(text) && Number.isSafeInteger(Number(text)) && Number(text) > 0;
}

export function validateBusFields(values) {
  const errors = {};
  if (!isPlate(values.plate))
    errors.plate = 'Escribe tres letras y cuatro dígitos, por ejemplo TBM-2213.';
  if (isBlank(values.vin)) errors.vin = 'Escribe el número de chasis.';
  if (!isUnitNumber(values.unitNumber))
    errors.unitNumber = 'Escribe un número de unidad entero mayor que cero.';
  if (isBlank(values.bodyworkBrand)) errors.bodyworkBrand = 'Escribe la marca de carrocería.';
  if (isBlank(values.color)) errors.color = 'Escribe el color.';
  if (isBlank(values.busGroupId)) errors.busGroupId = 'Elige un grupo.';
  if (isBlank(values.seatLayoutId)) errors.seatLayoutId = 'Elige una plantilla de asientos.';
  return errors;
}

function hasAllowedType(file) {
  const name = file.name.toLowerCase();
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
  return PHOTO_TYPES.get(extension) === file.type;
}

export function validatePhotos(files) {
  if (files.length === 0) return 'Adjunta al menos una fotografía.';
  if (files.length > MAX_BUS_PHOTOS) return `Adjunta como máximo ${MAX_BUS_PHOTOS} fotografías.`;
  if (files.some((file) => !hasAllowedType(file)))
    return 'Usa fotografías JPEG o PNG con extensión .jpg, .jpeg o .png.';
  if (files.some((file) => file.size === 0)) return 'Hay una fotografía vacía.';
  if (files.some((file) => file.size > MAX_BUS_PHOTO_BYTES))
    return 'Cada fotografía debe pesar como máximo 5 MB.';
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_BUS_PHOTOS_TOTAL_BYTES) return 'Las fotografías suman más de 50 MB.';
  return null;
}

export function formatPhotoSize(bytes) {
  if (bytes < BYTES_PER_MB) return `${Math.ceil(bytes / BYTES_PER_KB)} KB`;
  return `${(bytes / BYTES_PER_MB).toLocaleString('es-EC', { maximumFractionDigits: 1 })} MB`;
}

export function seatsByDeck(layout) {
  return layout.decks.map((deck) => ({
    number: deck.number,
    seats: deck.elements
      .filter((element) => element.kind === 'SEAT')
      .map(({ key, label }) => ({ key, label }))
      .sort((left, right) => left.label - right.label),
  }));
}

export function buildBusData(values, layout, disabledSeatKeys) {
  return {
    plate: values.plate.trim(),
    vin: values.vin.trim(),
    unitNumber: Number(String(values.unitNumber).trim()),
    bodyworkBrand: values.bodyworkBrand.trim(),
    color: values.color.trim(),
    busGroupId: values.busGroupId,
    seatLayoutId: layout.id,
    seatLayoutVersion: layout.version,
    disabledSeatKeys: [...disabledSeatKeys],
  };
}
