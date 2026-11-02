const { SeatLayoutCatalog } = require('../domain/seat-layout-catalog');
const { createBaseSeatLayouts } = require('./seat-layout-bases');

class StaticSeatLayoutCatalog extends SeatLayoutCatalog {
  async list() {
    return createBaseSeatLayouts();
  }
}

module.exports = StaticSeatLayoutCatalog;
