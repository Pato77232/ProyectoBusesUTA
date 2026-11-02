const { commercialInventory } = require('../../domain/value-objects/commercial-inventory');
const { CommercialTripSourceError } = require('../../domain/errors/commercial-trip-errors');
const planCycle = require('../../domain/services/plan-commercial-cycle');

async function prepareCommercialPublication({
  commercialSession,
  programmingRecord,
  seatQueryPort,
  seriesId,
  now,
}) {
  if (!commercialSession?.listSeries || !commercialSession?.save || !seatQueryPort?.listByBus)
    throw new CommercialTripSourceError();
  try {
    const programming = programmingRecord.programming;
    const cycle = planCycle({
      series: await commercialSession.listSeries(),
      seriesId,
      programming,
      now,
    });
    const inventories = [];
    const agendas = programming.agendas
      .filter((a) => a.activities.some((activity) => activity.kind === 'SERVICE'))
      .sort((a, b) => a.busId.localeCompare(b.busId));
    for (const agenda of agendas) {
      const source = await seatQueryPort.listByBus({
        busId: agenda.busId,
        cooperativeId: programming.cooperativeId,
      });
      inventories.push(commercialInventory(source, agenda.busId));
    }
    return { programmingRecord, cycle, inventories };
  } catch (error) {
    if (error.httpStatus) throw error;
    throw new CommercialTripSourceError();
  }
}
module.exports = prepareCommercialPublication;
