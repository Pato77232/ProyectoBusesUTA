const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATES = ["ACTIVE", "INACTIVE"];
const text = (value) => typeof value === "string" && value.trim().length > 0;
export const isUuid = (value) => typeof value === "string" && UUID.test(value);
const normalize = (value) => value.trim().toLowerCase();

export function readFilters(input = {}) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some(
      (key) => !["origin", "destination", "status"].includes(key),
    )
  )
    throw new Error("Filtros inválidos.");
  const filters = {};
  for (const key of ["origin", "destination", "status"]) {
    const value = input[key];
    if (value === "" || value === undefined) continue;
    if (typeof value !== "string") throw new Error("Filtros inválidos.");
    if (value.trim()) filters[key] = value.trim();
  }
  if (filters.status && !STATES.includes(filters.status))
    throw new Error("Selecciona un estado válido.");
  return filters;
}

export function readFrequency(row, cooperativeId, expectedId) {
  if (
    !row ||
    !isUuid(row.id) ||
    row.cooperative_id !== cooperativeId ||
    (expectedId && row.id !== expectedId) ||
    !["origin", "destination", "ant_resolution_number"].every((key) =>
      text(row[key]),
    ) ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(row.departure_time) ||
    !STATES.includes(row.status) ||
    !Array.isArray(row.stops) ||
    row.stops.some((stop) => !text(stop)) ||
    !Array.isArray(row.segment_prices) ||
    row.segment_prices.length !== row.stops.length + 1 ||
    row.segment_prices.some(
      (price) =>
        !Number.isFinite(price) ||
        price <= 0 ||
        price > 99_999_999.99 ||
        Math.abs(price * 100 - Math.round(price * 100)) > 0.000001,
    )
  )
    throw new Error("Frecuencia no verificable.");
  const points = [row.origin, ...row.stops, row.destination].map(normalize);
  if (new Set(points).size !== points.length)
    throw new Error("Recorrido no verificable.");
  return Object.freeze({
    id: row.id,
    cooperative_id: row.cooperative_id,
    origin: row.origin,
    destination: row.destination,
    departure_time: row.departure_time,
    ant_resolution_number: row.ant_resolution_number,
    status: row.status,
    stops: Object.freeze([...row.stops]),
    segment_prices: Object.freeze([...row.segment_prices]),
  });
}
export function matches(row, filters) {
  return (
    (!filters.status || row.status === filters.status) &&
    ["origin", "destination"].every(
      (key) => !filters[key] || normalize(row[key]) === normalize(filters[key]),
    )
  );
}
export function readList(response, cooperativeId, filters) {
  if (!Array.isArray(response?.frequencies))
    throw new Error("Listado no verificable.");
  const rows = response.frequencies.map((row) =>
    readFrequency(row, cooperativeId),
  );
  if (
    new Set(rows.map((row) => row.id)).size !== rows.length ||
    rows.some((row) => !matches(row, filters))
  )
    throw new Error("Listado no verificable.");
  return rows;
}
export function sameFrequency(first, second, { status = true } = {}) {
  return [
    "id",
    "cooperative_id",
    "origin",
    "destination",
    "departure_time",
    "ant_resolution_number",
    "stops",
    "segment_prices",
    ...(status ? ["status"] : []),
  ].every((key) => JSON.stringify(first[key]) === JSON.stringify(second[key]));
}
