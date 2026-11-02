const BusPhotoStorageError = require('../domain/bus-photo-storage-error');

/** Coordina únicamente la persistencia de un alta ya validada por el caso de uso. */
function createPersistBusWithPhotos({ repository, storage, logger }) {
  return async function persistBusWithPhotos({ photos, ...registration }) {
    let session;
    try {
      session = await storage.prepare({ busId: registration.id, photos });
      return await repository.create(
        { ...registration, photos: session.references.map(({ order, ...photo }) => photo) },
        { beforeCommit: session.promote },
      );
    } catch (error) {
      const context = {
        busId: registration.id,
        operationId: session?.operationId || error.operationId,
      };
      if (error.code === 'BUS_REGISTRATION_COMMIT_UNKNOWN') {
        logger.error({ ...context, event: 'fleet.bus_photo_commit_unknown' });
        throw error;
      }
      if (session) {
        try {
          await session.discard();
        } catch (cause) {
          logger.error({ ...context, event: 'fleet.bus_photo_cleanup_failed' });
          throw new BusPhotoStorageError({ ...context, cause, cleanupFailed: true });
        }
      } else if (error.cleanupFailed) {
        logger.error({ ...context, event: 'fleet.bus_photo_cleanup_failed' });
      }
      throw error;
    }
  };
}

module.exports = createPersistBusWithPhotos;
