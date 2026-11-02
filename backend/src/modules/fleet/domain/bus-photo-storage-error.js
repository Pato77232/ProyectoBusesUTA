class BusPhotoStorageError extends Error {
  constructor({ busId, operationId, cause, cleanupFailed = false }) {
    super('No se pudo completar el almacenamiento de fotografías.', { cause });
    this.name = 'BusPhotoStorageError';
    this.code = 'BUS_PHOTO_STORAGE_ERROR';
    this.busId = busId;
    this.operationId = operationId;
    this.cleanupFailed = cleanupFailed;
  }
}

module.exports = BusPhotoStorageError;
