import { isUuid, readFilters, readGroups, readSheets } from './contracts.js';

export function createRouteSheetListController({ client, view }) {
  let busy = false;
  let actor = null;
  let blocked = false;
  function show(mode, message, extra = {}) {
    view.render({ mode, message, rows: [], groups: [], ...extra });
  }
  async function verify() {
    const { user } = await client.request('/api/v1/auth/me');
    if (!user || !isUuid(user.id) || typeof user.role !== 'string')
      throw new Error('Sesión no verificable.');
    if (user.role !== 'COOPERATIVE_ADMIN') {
      blocked = true;
      show(
        'forbidden',
        'Necesitas una sesión de administrador de cooperativa para consultar hojas de ruta.',
      );
      return false;
    }
    if (!isUuid(user.cooperative_id))
      throw new Error('Cooperativa no verificable.');
    if (
      actor &&
      (actor.id !== user.id || actor.cooperative_id !== user.cooperative_id)
    ) {
      blocked = true;
      show(
        'session-changed',
        'La sesión cambió. Recarga la página para consultar con la identidad actual.',
      );
      return false;
    }
    actor = { id: user.id, cooperative_id: user.cooperative_id };
    return true;
  }
  async function load(input = {}) {
    if (busy || blocked) return;
    let filters;
    try {
      filters = readFilters(input);
    } catch (error) {
      show('invalid', error.message);
      return;
    }
    busy = true;
    show('loading', 'Comprobando sesión y consultando hojas de ruta…', {
      filters,
    });
    try {
      if (!(await verify())) return;
      const groups = readGroups(await client.request('/api/v1/bus-groups'));
      if (!(await verify())) return;
      if (
        filters.busGroupId &&
        !groups.some((group) => group.id === filters.busGroupId)
      ) {
        show(
          'invalid',
          'El grupo seleccionado ya no está disponible. Vuelve a seleccionarlo.',
          { groups, filters },
        );
        return;
      }
      const query = new URLSearchParams(filters).toString();
      const response = await client.request(
        `/api/v1/route-sheets${query ? `?${query}` : ''}`,
      );
      if (!(await verify())) return;
      const rows = readSheets(response, actor.cooperative_id, groups, filters);
      show(
        rows.length ? 'ready' : 'empty',
        rows.length
          ? `${rows.length} hoja(s) encontrada(s).`
          : groups.length
            ? 'No hay hojas de ruta para los filtros seleccionados.'
            : 'Tu cooperativa todavía no tiene grupos de buses ni hojas de ruta.',
        { rows, groups, filters },
      );
    } catch (error) {
      if (error?.status === 401)
        show(
          'signed-out',
          'Tu sesión venció o no está disponible. Inicia sesión y vuelve a consultar.',
        );
      else if (error?.status === 403) {
        blocked = true;
        show(
          'forbidden',
          'No tienes permiso para consultar estas hojas de ruta.',
        );
      } else
        show(
          'error',
          'No pudimos verificar la consulta. Comprueba la conexión y vuelve a consultar.',
        );
    } finally {
      busy = false;
    }
  }
  return { load };
}
