const { randomUUID } = require('node:crypto');
const {
  createBaseSeatLayouts,
} = require('../../src/modules/fleet/infrastructure/seat-layout-bases');
const {
  createBusSeatConfiguration,
} = require('../../src/modules/fleet/domain/bus-seat-configuration');

function busRequest({
  cooperativeId,
  busGroupId,
  data = {},
  photos,
  layout = createBaseSeatLayouts()[0],
}) {
  const metadata = {
    plate: ' tbm-0013 ',
    vin: ' vin0013 ',
    unitNumber: '01',
    bodyworkBrand: 'Marca de prueba',
    color: 'Azul',
    busGroupId,
    seatLayoutId: layout.id,
    seatLayoutVersion: layout.version,
    ...data,
  };
  return {
    id: randomUUID(),
    cooperativeId,
    data: metadata,
    configuration: createBusSeatConfiguration(metadata, layout),
    photos: photos || [{ fileKey: randomUUID(), contentType: 'image/jpeg', size: 100 }],
  };
}

async function fleetFixtures(pool) {
  const cooperatives = (
    await pool.query(
      "INSERT INTO cooperatives(name,ruc) VALUES ('Flota A','0011111111111'),('Flota B','0022222222222') RETURNING id",
    )
  ).rows;
  const groups = [];
  for (const cooperative of cooperatives) {
    groups.push(
      (
        await pool.query(
          "INSERT INTO bus_groups(cooperative_id,name,category) VALUES($1,'Rutas largas','LONG_ROUTE') RETURNING id",
          [cooperative.id],
        )
      ).rows[0],
    );
  }
  return {
    first: { cooperativeId: cooperatives[0].id, busGroupId: groups[0].id },
    second: { cooperativeId: cooperatives[1].id, busGroupId: groups[1].id },
  };
}

module.exports = { busRequest, fleetFixtures };
