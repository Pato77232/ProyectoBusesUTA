const EMAIL_KEY = "transviaje-registration-email";

export function safeReservationReturn(value) {
  if (value === "/pages/reservas.html") return value;
  if (typeof value !== "string" || !value.startsWith("/pages/reservas.html?"))
    return null;
  const query = new URLSearchParams(
    value.slice("/pages/reservas.html?".length),
  );
  const keys = ["tripId", "fromPosition", "toPosition"];
  if (
    [...query.keys()].length !== keys.length ||
    keys.some((key) => query.getAll(key).length !== 1)
  )
    return null;
  const tripId = query.get("tripId");
  const from = query.get("fromPosition");
  const to = query.get("toPosition");
  if (!tripId || /[#\u0000-\u001f]/u.test(tripId)) return null;
  if (![from, to].every((part) => /^(0|[1-9]\d*)$/u.test(part))) return null;
  if (!Number.isSafeInteger(Number(from)) || !Number.isSafeInteger(Number(to)))
    return null;
  if (Number(from) >= Number(to)) return null;
  return (
    "/pages/reservas.html?" +
    new URLSearchParams({ tripId, fromPosition: from, toPosition: to })
  );
}

export function readReservationReturn(search) {
  const params = new URLSearchParams(search);
  return params.getAll("next").length === 1
    ? safeReservationReturn(params.get("next"))
    : null;
}

export function loginPath(next) {
  return (
    "/pages/login.html" + (next ? "?" + new URLSearchParams({ next }) : "")
  );
}

export function saveRegistrationEmail(storage, email) {
  try {
    storage.setItem(EMAIL_KEY, email);
  } catch {
    // El registro sigue confirmado aunque el navegador no permita almacenamiento.
  }
}

export function takeRegistrationEmail(storage) {
  try {
    const email = storage.getItem(EMAIL_KEY);
    storage.removeItem(EMAIL_KEY);
    return email || null;
  } catch {
    return null;
  }
}
