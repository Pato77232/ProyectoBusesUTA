const {
  BusPhotoNotFoundError,
  assertBusQueryActor,
  isBusIdentifier,
} = require('../domain/bus-query-error');

function getBusPhoto({ repository, storage }) {
  return async ({ busId, photoId }, actor) => {
    const cooperativeId = assertBusQueryActor(actor);
    if (!isBusIdentifier(busId) || !isBusIdentifier(photoId)) throw new BusPhotoNotFoundError();
    const photo = await repository.findPhotoById({ busId, photoId, cooperativeId });
    if (!photo) throw new BusPhotoNotFoundError();
    return {
      contentType: photo.contentType,
      bytes: await storage.read({ busId, fileKey: photo.fileKey, size: photo.size }),
    };
  };
}

module.exports = getBusPhoto;
