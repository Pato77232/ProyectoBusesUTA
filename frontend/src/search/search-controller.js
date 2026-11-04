export function createSearchController({ client, view }) {
  let busy = false;
  return {
    async search(input) {
      if (busy) return;
      busy = true;
      view.busy(true);
      view.show('loading', 'Consultando viajes publicados…', []);
      try {
        const query = new URLSearchParams({
          origin: input.origin.trim(),
          destination: input.destination.trim(),
          date: input.date,
        });
        const result = await client.request('/api/v1/trips?' + query);
        if (
          !Array.isArray(result?.trips) ||
          typeof result.truncated !== 'boolean' ||
          result.trips.some(
            (t) =>
              !t ||
              !/^[a-f0-9-]{36}$/i.test(t.tripId) ||
              typeof t.cooperativeName !== 'string' ||
              !t.cooperativeName.trim() ||
              typeof t.origin !== 'string' ||
              typeof t.destination !== 'string' ||
              !Number.isSafeInteger(t.fromPosition) ||
              !Number.isSafeInteger(t.toPosition) ||
              t.fromPosition < 0 ||
              t.toPosition <= t.fromPosition ||
              !Number.isFinite(Date.parse(t.boardingAt)) ||
              !Number.isFinite(Date.parse(t.arrivalAt)) ||
              Date.parse(t.arrivalAt) <= Date.parse(t.boardingAt) ||
              t.currency !== 'USD' ||
              !Number.isSafeInteger(t.amountCents) ||
              t.amountCents <= 0,
          )
        )
          throw new Error('Respuesta inválida');
        const keys = result.trips.map((t) => `${t.tripId}:${t.fromPosition}:${t.toPosition}`);
        if (new Set(keys).size !== keys.length) throw new Error('Respuesta duplicada');
        view.show(
          result.trips.length ? 'ready' : 'empty',
          result.truncated
            ? 'Se alcanzó el límite de resultados. Precisa la fecha o las ciudades.'
            : result.trips.length
              ? 'Elige un viaje para consultar sus asientos.'
              : 'No hay viajes comercializables para esa búsqueda.',
          result.trips,
        );
      } catch {
        view.show(
          'error',
          'No se pudo comprobar la oferta. Revisa los datos y vuelve a buscar.',
          [],
        );
      } finally {
        busy = false;
        view.busy(false);
      }
    },
  };
}
