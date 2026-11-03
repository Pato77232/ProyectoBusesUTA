function row(changes = {}) {
  return {
    id: 'reserva-1',
    owner_id: 'cliente-1',
    cooperative_id: 'cooperativa-1',
    status: 'PENDING_PAYMENT',
    total_price_cents: '875',
    summary_total: '875',
    currency: 'USD',
    created_at: new Date('2026-11-02T13:00:00.000Z'),
    proof_window_started_at: new Date('2026-11-02T14:00:00.000Z'),
    proof_window_seconds: 300,
    expires_at: new Date('2026-11-02T14:05:00.000Z'),
    proof_reception_state: 'NOT_RECEIVED',
    accepted_proof_id: null,
    proof_received_at: null,
    ...changes,
  };
}
const customer = () => ({ userId: 'cliente-1', role: 'CUSTOMER', cooperativeId: null });
const clerk = () => ({ userId: 'oficinista-1', role: 'CLERK', cooperativeId: 'cooperativa-1' });
const query = (purpose = 'UPLOAD_PROOF') => ({ bookingId: 'reserva-1', purpose });
module.exports = { row, customer, clerk, query };
