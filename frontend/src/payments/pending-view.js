const money = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
const dates = new Intl.DateTimeFormat('es-EC', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Guayaquil',
});
const TYPES = { 'application/pdf': 'PDF', 'image/png': 'PNG', 'image/jpeg': 'JPEG' };

export function createPendingView(document) {
  const find = (selector) => document.querySelector(selector);
  const list = find('#proofs');
  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function card(item) {
    const article = element('article', 'payment-proof');
    const heading = element('div', 'payment-proof-heading');
    heading.append(
      element('span', 'payment-file-type', TYPES[item.mediaType]),
      element('h2', '', item.fileName),
      element('span', 'payment-badge', 'Pendiente'),
    );
    const details = element('dl', 'payment-details');
    for (const [label, value] of [
      ['Reserva', item.bookingId],
      ['Total de la reserva', money.format(item.totalCents / 100)],
      ['Recibido', `${dates.format(new Date(item.uploadedAt))} · Ecuador`],
      [
        'Archivo',
        `${TYPES[item.mediaType]} · ${Math.max(1, Math.ceil(item.fileSizeBytes / 1024))} KB`,
      ],
    ]) {
      const group = element('div', '');
      group.append(element('dt', '', label), element('dd', '', value));
      details.append(group);
    }
    const link = element('a', 'payment-file-link', 'Abrir comprobante ↗');
    link.href = `/api/v1/payment-proofs/${encodeURIComponent(item.id)}/file`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `Abrir ${item.fileName} en otra pestaña`);
    article.append(heading, details, link);
    return article;
  }
  return {
    render({
      mode,
      message,
      items = [],
      hasNext = false,
      hasPrevious = false,
      pageNumber = 1,
      needsLogin = false,
    }) {
      find('#status').textContent = message;
      find('#status-panel').dataset.mode = mode;
      list.setAttribute('aria-busy', String(mode === 'loading'));
      find('#refresh').disabled = mode === 'loading';
      find('#next').disabled = mode !== 'ready' || !hasNext;
      find('#previous').disabled = mode !== 'ready' || !hasPrevious;
      find('#retry').hidden = mode !== 'error' || needsLogin;
      find('#session-link').hidden = !needsLogin;
      find('#page-number').textContent =
        mode === 'ready' ? `Página ${pageNumber}` : 'Bandeja de tu cooperativa';
      find('#page-count').textContent =
        mode === 'ready' ? `${items.length} en esta página` : 'Solo comprobantes pendientes';
      list.replaceChildren(...items.map(card));
      const empty = find('#empty-state');
      empty.hidden = mode === 'ready' && items.length > 0;
      find('#empty-title').textContent =
        mode === 'loading'
          ? 'Preparando tu bandeja'
          : mode === 'ready'
            ? 'Todo al día en esta página'
            : 'Tu bandeja es privada';
      find('#empty-description').textContent =
        mode === 'loading'
          ? 'Estamos comprobando tu sesión y consultando los archivos.'
          : mode === 'ready'
            ? 'Cuando lleguen nuevos comprobantes, podrás consultarlos aquí.'
            : 'Necesitas una sesión de oficinista para consultar los comprobantes de tu cooperativa.';
      if (mode === 'error') {
        find('#empty-title').textContent = 'La bandeja no está disponible';
        find('#empty-description').textContent =
          'El resultado de la consulta no pudo confirmarse. No se ha modificado ningún pago.';
      }
    },
  };
}
