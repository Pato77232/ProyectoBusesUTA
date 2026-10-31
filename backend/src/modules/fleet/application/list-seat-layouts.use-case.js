const { BASE_LAYOUT_IDS } = require('../domain/seat-layout-catalog');
const { createSeatLayout, InvalidSeatLayoutError } = require('../domain/seat-layout');

function listSeatLayouts({ catalog }) {
  return async () => {
    const layouts = await catalog.list();
    if (!Array.isArray(layouts) || layouts.length !== BASE_LAYOUT_IDS.length) {
      throw new InvalidSeatLayoutError();
    }
    const validated = layouts.map(createSeatLayout);
    if (new Set(validated.map((layout) => layout.id)).size !== BASE_LAYOUT_IDS.length) {
      throw new InvalidSeatLayoutError();
    }
    return Object.freeze(
      BASE_LAYOUT_IDS.map((id) => {
        const layout = validated.find((entry) => entry.id === id);
        if (!layout) throw new InvalidSeatLayoutError();
        return layout;
      }),
    );
  };
}

module.exports = listSeatLayouts;
