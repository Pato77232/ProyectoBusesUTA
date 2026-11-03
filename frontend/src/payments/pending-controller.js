const PATH = '/api/v1/payment-proofs';
const FILE_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

function readPage(page) {
  if (
    !Array.isArray(page?.items) ||
    !(
      page.nextCursor === null ||
      (typeof page.nextCursor === 'string' && page.nextCursor.length > 0)
    )
  )
    throw new Error('Respuesta inválida');
  const items = page.items.map((item) => {
    if (
      !item ||
      typeof item.id !== 'string' ||
      !/^[a-zA-Z0-9-]+$/u.test(item.id) ||
      typeof item.fileName !== 'string' ||
      !item.fileName ||
      typeof item.bookingId !== 'string' ||
      !item.bookingId ||
      !Number.isSafeInteger(item.totalCents) ||
      item.totalCents < 0 ||
      item.currency !== 'USD' ||
      item.status !== 'UPLOADED' ||
      !FILE_TYPES.has(item.mediaType) ||
      !Number.isSafeInteger(item.fileSizeBytes) ||
      item.fileSizeBytes <= 0 ||
      typeof item.uploadedAt !== 'string' ||
      !Number.isFinite(Date.parse(item.uploadedAt))
    )
      throw new Error('Comprobante inválido');
    return {
      id: item.id,
      fileName: item.fileName,
      bookingId: item.bookingId,
      totalCents: item.totalCents,
      uploadedAt: item.uploadedAt,
      mediaType: item.mediaType,
      fileSizeBytes: item.fileSizeBytes,
    };
  });
  return { items, nextCursor: page.nextCursor };
}

export function createPendingController({ client, view }) {
  let busy = false;
  let cursors = [null];
  let pageIndex = 0;
  let nextCursor = null;
  let identity = null;
  let failedAction = 'refresh';
  let canNavigate = false;

  async function navigate(action, retry = false) {
    if (
      busy ||
      (!retry &&
        ((action === 'next' && (!canNavigate || !nextCursor)) ||
          (action === 'previous' && (!canNavigate || pageIndex === 0))))
    )
      return;
    busy = true;
    view.render({ mode: 'loading', message: 'Consultando comprobantes…' });
    let targetIndex =
      action === 'next' ? pageIndex + 1 : action === 'previous' ? pageIndex - 1 : pageIndex;
    let cursor = action === 'next' ? nextCursor : cursors[targetIndex];
    try {
      const { user } = await client.request('/api/v1/auth/me');
      if (user?.role !== 'CLERK') {
        identity = null;
        cursors = [null];
        pageIndex = 0;
        nextCursor = null;
        canNavigate = false;
        view.render({ mode: 'denied', message: 'Esta bandeja está disponible para oficinistas.' });
        return;
      }
      const currentIdentity = JSON.stringify([user.id, user.cooperative_id]);
      if (identity !== currentIdentity) {
        identity = currentIdentity;
        cursors = [null];
        pageIndex = 0;
        nextCursor = null;
        targetIndex = 0;
        cursor = null;
      }
      const page = readPage(
        await client.request(cursor ? `${PATH}?cursor=${encodeURIComponent(cursor)}` : PATH),
      );
      cursors[targetIndex] = cursor;
      cursors.length = targetIndex + 1;
      pageIndex = targetIndex;
      nextCursor = page.nextCursor;
      canNavigate = true;
      view.render({
        mode: 'ready',
        message: page.items.length
          ? 'Comprobantes pendientes de revisión.'
          : 'No hay comprobantes pendientes en esta página.',
        items: page.items,
        hasNext: Boolean(nextCursor),
        hasPrevious: pageIndex > 0,
        pageNumber: pageIndex + 1,
      });
    } catch (error) {
      failedAction = action;
      if (error.status === 401 || error.status === 403) {
        identity = null;
        canNavigate = false;
      }
      view.render({
        mode: 'error',
        needsLogin: error.status === 401,
        message:
          error.status === 401
            ? 'Tu sesión no está disponible. Inicia sesión para consultar la bandeja.'
            : error.status === 403
              ? 'No tienes permiso para consultar esta bandeja.'
              : 'No pudimos consultar los comprobantes. Puedes volver a intentarlo.',
      });
    } finally {
      busy = false;
    }
  }
  return {
    load: (next = false) => navigate(next ? 'next' : 'refresh'),
    previous: () => navigate('previous'),
    retry: () => navigate(failedAction, true),
  };
}
