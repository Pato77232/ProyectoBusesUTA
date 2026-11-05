function startPasswordResetWorker({ runBatch, intervalMs, onFailure = () => {} }) {
  let stopped = false;
  let timer;
  let inFlight;
  function cycle() {
    if (stopped || inFlight) return;
    inFlight = Promise.resolve()
      .then(() => (stopped ? undefined : runBatch()))
      .catch(async () => {
        try {
          await onFailure();
        } catch {
          /* Continuar tras un observador fallido. */
        }
      })
      .finally(() => {
        inFlight = null;
        if (!stopped) {
          timer = globalThis.setTimeout(cycle, intervalMs);
          timer.unref?.();
        }
      });
  }
  cycle();
  return Object.freeze({
    stop() {
      stopped = true;
      if (timer) globalThis.clearTimeout(timer);
      return inFlight || Promise.resolve();
    },
  });
}

module.exports = startPasswordResetWorker;
