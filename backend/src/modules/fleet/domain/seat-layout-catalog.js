const BASE_LAYOUT_IDS = Object.freeze(['SINGLE_DECK_2_2', 'DOUBLE_DECK_2_2', 'DOUBLE_DECK_2_1']);

/** Puerto de lectura de las bases comunes; no contiene inventarios por bus. */
class SeatLayoutCatalog {
  async list() {
    throw new Error('SeatLayoutCatalog.list debe implementarse.');
  }
}

module.exports = { SeatLayoutCatalog, BASE_LAYOUT_IDS };
