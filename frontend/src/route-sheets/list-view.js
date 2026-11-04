export function createRouteSheetListView(document) {
  const find = (selector) => document.querySelector(selector);
  const groupSelect = find('#bus-group');
  const rows = find('#sheet-rows');
  function element(tag, text) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  }
  return {
    render({ mode, message, groups = [], rows: sheets = [], filters = {} }) {
      find('#status').textContent = message;
      find('#status-panel').dataset.mode = mode;
      find('#results').setAttribute('aria-busy', String(mode === 'loading'));
      find('#filters-fields').disabled = [
        'loading',
        'forbidden',
        'session-changed',
        'signed-out',
      ].includes(mode);
      find('#retry').hidden = !['error', 'signed-out'].includes(mode);
      find('#login-link').hidden = mode !== 'signed-out';
      groupSelect.replaceChildren(element('option', 'Todos los grupos'));
      groupSelect.firstElementChild.value = '';
      for (const group of groups) {
        const option = element('option', group.name);
        option.value = group.id;
        groupSelect.append(option);
      }
      groupSelect.value = filters.busGroupId || '';
      rows.replaceChildren();
      const groupNames = new Map(groups.map((group) => [group.id, group.name]));
      for (const sheet of sheets) {
        const row = element('tr');
        const [year, month, day] = sheet.routeDate.split('-');
        for (const text of [
          `${day}/${month}/${year}`,
          groupNames.get(sheet.busGroupId),
          sheet.status === 'DRAFT' ? 'Borrador' : 'Publicada',
          sheet.id,
        ])
          row.append(element('td', text));
        rows.append(row);
      }
      find('#sheets-table').hidden = sheets.length === 0;
      find('#table-help').hidden = sheets.length === 0;
      if (mode === 'invalid') find('#status').focus();
    },
  };
}
