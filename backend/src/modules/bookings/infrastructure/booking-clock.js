const formatter = new Intl.DateTimeFormat('en', {
  timeZone: 'America/Guayaquil',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
function calendarDateAt(instant) {
  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
module.exports = calendarDateAt;
