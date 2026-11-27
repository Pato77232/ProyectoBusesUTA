// FRONT-02 T7: aprobación y rechazo de comprobantes (PAGOS-02, RN-53/RN-54).
const PATH = '/api/v1/payment-proofs';
const SAFE_ID = /^[a-zA-Z0-9-]+$/u;

const UNCERTAIN = new Set([
  'PAYMENT_PROOF_APPROVAL_PERSISTENCE_UNCERTAIN',
  'PAYMENT_PROOF_APPROVAL_INTENT_PERSISTENCE_FAILED',
  'PAYMENT_PROOF_RECONCILIATION_REQUIRED',
  'PAYMENT_PROOF_PERSISTENCE_UNCERTAIN',
]);

const MESSAGES = Object.freeze({
  PAYMENT_PROOF_NOT_PENDING: 'Este comprobante ya fue resuelto o venció. Actualiza la bandeja.',
  PAYMENT_PROOF_NOT_FOUND: 'El comprobante ya no está disponible para tu cooperativa.',
  PAYMENT_PROOF_EXPIRED: 'La reserva venció; el comprobante ya no puede aprobarse.',
  PAYMENT_PROOF_TOTAL_UNAVAILABLE:
    'No pudimos confirmar el total de la reserva. Inténtalo más tarde.',
  PAYMENT_PROOF_VALIDATION_ERROR: 'Escribe el motivo del rechazo.',
});

export function decisionMessage(error) {
  if (error?.status === 401) return 'Tu sesión terminó. Inicia sesión de nuevo.';
  if (error?.status === 403) return 'No tienes permiso para resolver comprobantes.';
  if (UNCERTAIN.has(error?.code) || !error?.status || error.status >= 500)
    return 'No pudimos confirmar el resultado. Actualiza la bandeja antes de volver a intentarlo.';
  return MESSAGES[error?.code] ?? 'No se pudo registrar la decisión. Inténtalo de nuevo.';
}

export function createDecisionController({ client, view }) {
  let busy = false;

  async function decide(id, action, data, expected) {
    if (busy || typeof id !== 'string' || !SAFE_ID.test(id)) return false;
    busy = true;
    view.busy(id, true);
    try {
      const result = await client.request(`${PATH}/${encodeURIComponent(id)}/${action}`, {
        method: 'POST',
        ...(data ? { data } : {}),
      });
      if (result?.paymentProof?.id !== id || result.paymentProof.decision !== expected) {
        view.failed(id, decisionMessage({ code: 'PAYMENT_PROOF_PERSISTENCE_UNCERTAIN' }));
        return false;
      }
      view.decided(
        id,
        expected === 'APPROVED'
          ? 'Pago aprobado. Los boletos del cliente quedan emitidos.'
          : 'Comprobante rechazado. El motivo quedó registrado.',
      );
      return true;
    } catch (error) {
      view.failed(id, decisionMessage(error));
      return false;
    } finally {
      busy = false;
      view.busy(id, false);
    }
  }

  return {
    approve(id, { reviewed } = {}) {
      if (!reviewed) {
        view.failed(id, 'Confirma que revisaste el archivo y el total antes de aprobar.');
        return Promise.resolve(false);
      }
      return decide(id, 'approve', undefined, 'APPROVED');
    },
    reject(id, justification) {
      const text = typeof justification === 'string' ? justification.trim() : '';
      if (!text) {
        view.failed(id, 'Escribe el motivo del rechazo. Es obligatorio.');
        return Promise.resolve(false);
      }
      return decide(id, 'reject', { justification: text }, 'REJECTED');
    },
  };
}
