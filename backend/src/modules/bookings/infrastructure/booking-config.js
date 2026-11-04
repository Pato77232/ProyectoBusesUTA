const { createBookingDeadline } = require('../domain/booking-deadline');

const DEFAULT_PROOF_WINDOW_SECONDS = 300;
function readBookingConfig(env = {}) {
  const raw = env.BOOKING_PROOF_WINDOW_SECONDS;
  if (raw !== undefined && (typeof raw !== 'string' || !/^\d+$/.test(raw))) {
    throw new Error('BOOKING_PROOF_WINDOW_SECONDS debe ser un entero de 180 a 300.');
  }
  const proofWindowSeconds = raw === undefined ? DEFAULT_PROOF_WINDOW_SECONDS : Number(raw);
  createBookingDeadline(new Date(0), proofWindowSeconds);
  return Object.freeze({ proofWindowSeconds });
}
module.exports = readBookingConfig;
