// La migración de las tablas de frecuencias declaró `precision` y `scale`, opciones que
// node-pg-migrate ignora: `amount` quedó como `numeric` sin escala. Aquí se fija `numeric(10,2)`
// como exige FREQ-01 §5 para los montos de tramo.
exports.up = (pgm) => {
  pgm.alterColumn('frequency_segment_prices', 'amount', {
    type: 'numeric(10,2)',
    using: 'amount::numeric(10,2)',
  });
};

exports.down = (pgm) => {
  pgm.alterColumn('frequency_segment_prices', 'amount', { type: 'numeric' });
};
