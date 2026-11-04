module.exports = function startExpirationWorker({
  runBatch,
  enabled,
  intervalMs,
  onError = () => {},
}) {
  let stopped = !enabled;
  let timer;
  let inFlight;
  function cycle() {
    if (stopped || inFlight) return;
    inFlight = Promise.resolve()
      .then(() => (stopped ? undefined : runBatch()))
      .catch(async (error) => {
        try {
          await onError(error);
        } catch {
          /* Continuar tras observador fallido. */
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
};
