/** Bucle del trabajador: una ronda a la vez, sin solaparse, y detención ordenada. */
function startNotificationWorker({ runBatch, intervalMs, onFailure = () => {} }) {
  let stopped = false;
  let timer;
  let inFlight;
  function cycle() {
    if (stopped || inFlight) return;
    inFlight = Promise.resolve()
      .then(() => (stopped ? undefined : runBatch()))
      .catch(async (error) => {
        try {
          await onFailure({ errorType: error?.name });
        } catch {
          /* Un observador fallido no detiene el trabajador. */
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

module.exports = startNotificationWorker;
