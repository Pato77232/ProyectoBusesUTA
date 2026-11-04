const { readdir } = require('node:fs/promises');
const path = require('node:path');

const historicalNames = Object.freeze([
  '1793145600000-create-bookings',
  '1793232000000-booking-creation-idempotency',
  '1793740000000-booking-payment-read-context',
]);
const activeNames = Object.freeze([
  '1792100000000-infrastructure',
  '1792100001000-authentication',
  '1792280000000-create-cooperatives',
  '1792280001000-user-cooperative-integrity',
  '1792280002000-unique-cooperative-admin',
  '1792460000000-frequencies',
  '1792460001000-frequency-segment-price-precision',
  '1792470000000-create-bus-groups',
  '1792480000000-create-route-sheets',
  '1793123000000-payment-proofs-and-outbox',
  '1793130000000-payment-proof-approvals',
  '1793140000000-payment-proof-approval-intents',
  '1793440000000-register-buses',
  '1793570000000-route-sheet-draft-tariffs',
  '1793570001000-freeze-route-sheet-tariffs',
  '1793650000000-route-sheet-programming',
  '1793730000000-commercial-trips',
  '1793740000000-allow-vip-bus-seats',
  '1793820000000-install-bookings',
  '1793910000000-booking-proof-receipts',
  '1794000000000-payment-booking-identifiers',
  '1794080000000-protect-bus-seats',
  '1794086400000-payment-proof-upload-provenance',
  '1794160000000-route-sheet-renewals',
  '1794250000000-booking-commercial-totals',
]);
const migrationsDirectory = path.join(__dirname, '../migrations');
// node-pg-migrate ancla este patrón; preservar explícitamente su exclusión de ocultos.
const ignorePattern = `(?:\\..*|(?:${historicalNames.join('|')})\\.js)`;

class MigrationSafetyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MigrationSafetyError';
    this.code = code;
  }
}

function validateCatalog(entries) {
  const visible = entries.filter(({ name }) => !new RegExp(`^${ignorePattern}$`).test(name));
  const names = visible.map(({ name }) => name).sort();
  if (
    visible.some((entry) => !entry.isFile()) ||
    names.length !== activeNames.length ||
    names.some((name, index) => name !== activeNames[index] + '.js')
  ) {
    throw new MigrationSafetyError(
      'MIGRATION_CATALOG_INVALID',
      'El catálogo de migraciones no coincide con los archivos activos. Revise la versión del proyecto.',
    );
  }
}

async function assertCatalog() {
  validateCatalog(await readdir(migrationsDirectory, { withFileTypes: true }));
}

function validateHistory(names) {
  if (names.some((name) => historicalNames.includes(name))) {
    throw new MigrationSafetyError(
      'MIGRATION_HISTORY_UNSUPPORTED',
      'El historial contiene migraciones originales de Reservas. Esta base requiere un plan de actualización aparte; no se aplicaron cambios.',
    );
  }
  if (names.length > activeNames.length || names.some((name, i) => name !== activeNames[i])) {
    throw new MigrationSafetyError(
      'MIGRATION_HISTORY_UNEXPECTED',
      'Historial de migraciones inesperado: se exige un prefijo ordenado del catálogo activo. No se aplicaron cambios.',
    );
  }
}

module.exports = {
  activeNames,
  historicalNames,
  migrationsDirectory,
  ignorePattern,
  MigrationSafetyError,
  validateCatalog,
  assertCatalog,
  validateHistory,
};
