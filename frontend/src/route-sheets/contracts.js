const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATES = ['DRAFT', 'PUBLISHED'];
export const isUuid = (value) => typeof value === 'string' && UUID.test(value);

export function isDate(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith('0000')
  )
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function readFilters(input = {}) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some(
      (key) => !['busGroupId', 'fromDate', 'toDate', 'status'].includes(key),
    )
  )
    throw new Error('Los filtros no son válidos.');
  const filters = {};
  for (const key of ['busGroupId', 'fromDate', 'toDate', 'status']) {
    const value = input[key];
    if (value === '' || value === undefined) continue;
    if (typeof value !== 'string')
      throw new Error('Los filtros no son válidos.');
    filters[key] = value;
  }
  if (filters.busGroupId && !isUuid(filters.busGroupId))
    throw new Error('Selecciona un grupo de la lista.');
  for (const key of ['fromDate', 'toDate'])
    if (filters[key] && !isDate(filters[key]))
      throw new Error('Introduce fechas válidas.');
  if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate)
    throw new Error(
      'La fecha desde debe ser anterior o igual a la fecha hasta.',
    );
  if (filters.status && !STATES.includes(filters.status))
    throw new Error('Selecciona un estado válido.');
  return filters;
}

export function readGroups(response) {
  const groups = response?.busGroups;
  const ids = new Set();
  if (
    !Array.isArray(groups) ||
    groups.some((group) => {
      if (
        !group ||
        !isUuid(group.id) ||
        typeof group.name !== 'string' ||
        !group.name.trim() ||
        ids.has(group.id)
      )
        return true;
      ids.add(group.id);
      return false;
    })
  )
    throw new Error('Respuesta de grupos no verificable.');
  return groups.map(({ id, name }) => ({ id, name }));
}

export function readSheets(response, cooperativeId, groups, filters) {
  const rows = response?.routeSheets;
  const ids = new Set();
  const groupIds = new Set(groups.map((group) => group.id));
  if (
    !Array.isArray(rows) ||
    rows.some((row) => {
      if (
        !row ||
        !isUuid(row.id) ||
        ids.has(row.id) ||
        row.cooperativeId !== cooperativeId ||
        !groupIds.has(row.busGroupId) ||
        !isDate(row.routeDate) ||
        !STATES.includes(row.status)
      )
        return true;
      ids.add(row.id);
      return (
        (filters.busGroupId && row.busGroupId !== filters.busGroupId) ||
        (filters.status && row.status !== filters.status) ||
        (filters.fromDate && row.routeDate < filters.fromDate) ||
        (filters.toDate && row.routeDate > filters.toDate)
      );
    })
  )
    throw new Error('Respuesta de hojas no verificable.');
  return rows.map(({ id, busGroupId, routeDate, status }) => ({
    id,
    busGroupId,
    routeDate,
    status,
  }));
}
