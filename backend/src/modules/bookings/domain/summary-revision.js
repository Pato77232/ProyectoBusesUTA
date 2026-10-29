const { createHash } = require('node:crypto');

// Solo recibe el resumen canónico creado por el dominio. No es una autorización.
function summaryRevision(summary) {
  return createHash('sha256')
    .update('bookings-summary-v1\n')
    .update(JSON.stringify(summary))
    .digest('hex');
}
module.exports = summaryRevision;
