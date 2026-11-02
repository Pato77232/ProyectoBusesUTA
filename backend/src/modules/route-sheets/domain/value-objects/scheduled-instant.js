const { BusAgendaValidationError } = require('../errors/bus-agenda-errors');

const MILLISECONDS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const ISO_INSTANT =
  /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

function parseScheduledInstant(value, field) {
  const parts = typeof value === 'string' && ISO_INSTANT.exec(value);
  if (!parts) {
    throw new BusAgendaValidationError(`${field} requiere fecha y hora ISO con zona explícita.`);
  }
  const [, date, hour, minute, second = '00', fraction = '', zone] = parts;
  const offsetHours = zone === 'Z' ? 0 : Number(zone.slice(1, 3));
  const offsetMinutes = zone === 'Z' ? 0 : Number(zone.slice(4, 6));
  const direction = zone.startsWith('-') ? -1 : 1;
  const offset = direction * (offsetHours * MINUTES_PER_HOUR + offsetMinutes);
  const timestamp = Date.parse(`${date}T${hour}:${minute}:${second}${fraction}${zone}`);
  const local = new Date(timestamp + offset * MILLISECONDS_PER_MINUTE);
  const calendar = `${date}T${hour}:${minute}:${second}`;
  if (
    offsetHours > 23 ||
    offsetMinutes > 59 ||
    !Number.isFinite(local.getTime()) ||
    local.toISOString().slice(0, 19) !== calendar
  ) {
    throw new BusAgendaValidationError(`${field} contiene una fecha u hora inválida.`);
  }
  return timestamp;
}

function calculateReadyAt(arrivalAt, preparationMinutes) {
  if (!Number.isSafeInteger(preparationMinutes) || preparationMinutes < 0) {
    throw new BusAgendaValidationError(
      'preparationMinutes debe ser un entero no negativo explícito.',
    );
  }
  const duration = preparationMinutes * MILLISECONDS_PER_MINUTE;
  const readyAt = arrivalAt + duration;
  if (!Number.isSafeInteger(duration) || !Number.isFinite(new Date(readyAt).getTime())) {
    throw new BusAgendaValidationError('La preparación excede el intervalo de fechas admitido.');
  }
  return readyAt;
}

module.exports = { parseScheduledInstant, calculateReadyAt };
