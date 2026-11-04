// La validación se mantiene independiente del transporte y la persistencia.
class SearchValidationError extends Error {
  constructor() {
    super('Indica origen, destino y una fecha real.');
    this.name = 'SearchValidationError';
    this.code = 'SEARCH_INVALID';
  }
}
function invalid() {
  throw new SearchValidationError();
}
module.exports = (input) => {
  if (!input || Object.keys(input).some((key) => !['origin', 'destination', 'date'].includes(key)))
    invalid();
  const text = (value) => {
    if (
      typeof value !== 'string' ||
      !value.trim() ||
      value.length > 100 ||
      /[\u0000-\u001f]/.test(value)
    )
      invalid();
    return value.trim().normalize('NFC');
  };
  const origin = text(input.origin),
    destination = text(input.destination),
    date = input.date;
  if (
    origin.toLowerCase() === destination.toLowerCase() ||
    typeof date !== 'string' ||
    !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date + 'T00:00:00Z')) ||
    new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date
  )
    invalid();
  return Object.freeze({ origin, destination, date });
};
