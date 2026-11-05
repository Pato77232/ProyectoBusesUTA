class BusQueryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

class BusQueryForbiddenError extends BusQueryError {
  constructor() {
    super('FORBIDDEN', 'Acceso no permitido.');
  }
}

class BusNotFoundError extends BusQueryError {
  constructor() {
    super('BUS_NOT_FOUND', 'El bus no está disponible.');
  }
}

class BusPhotoNotFoundError extends BusQueryError {
  constructor() {
    super('BUS_PHOTO_NOT_FOUND', 'La fotografía no está disponible.');
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertBusQueryActor(actor) {
  if (actor?.role !== 'COOPERATIVE_ADMIN' || !UUID_PATTERN.test(actor.cooperative_id ?? ''))
    throw new BusQueryForbiddenError();
  return actor.cooperative_id;
}

function isBusIdentifier(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

module.exports = {
  BusQueryForbiddenError,
  BusNotFoundError,
  BusPhotoNotFoundError,
  assertBusQueryActor,
  isBusIdentifier,
};
