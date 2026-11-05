const SESSION = "/api/v1/auth/me";
const BUSES = "/api/v1/buses";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isBusSummary(bus) {
  return (
    UUID.test(bus?.id ?? "") &&
    typeof bus.plate === "string" &&
    Number.isSafeInteger(bus.unitNumber) &&
    Number.isSafeInteger(bus.capacity) &&
    Number.isSafeInteger(bus.photoCount) &&
    typeof bus.busGroupName === "string"
  );
}

function isBusDetails(bus) {
  return (
    isBusSummary({
      ...bus,
      busGroupName: bus?.busGroup?.name,
      photoCount: bus?.photos?.length,
    }) &&
    typeof bus.vin === "string" &&
    typeof bus.bodyworkBrand === "string" &&
    typeof bus.color === "string" &&
    typeof bus.busGroup?.name === "string" &&
    Array.isArray(bus.seats) &&
    Array.isArray(bus.photos) &&
    bus.photos.every(
      (photo) =>
        UUID.test(photo?.id ?? "") &&
        ["image/jpeg", "image/png"].includes(photo.contentType) &&
        Number.isSafeInteger(photo.size) &&
        Number.isSafeInteger(photo.order),
    ) &&
    bus.seats.every(
      (seat) =>
        UUID.test(seat?.seatId ?? "") &&
        Number.isSafeInteger(seat.label) &&
        Number.isSafeInteger(seat.deck) &&
        ["NORMAL", "VIP", "ACCESSIBLE"].includes(seat.category) &&
        typeof seat.offered === "boolean",
    )
  );
}

function isAdmin(user) {
  return (
    user?.role === "COOPERATIVE_ADMIN" &&
    UUID.test(user.id ?? "") &&
    UUID.test(user.cooperative_id ?? "")
  );
}

function createBusInventoryController({
  client,
  view,
  location = globalThis.location,
}) {
  async function verifySession() {
    const { user } = (await client.request(SESSION)) ?? {};
    if (!isAdmin(user)) {
      view.blocked(
        "Necesitas una sesión de administrador de cooperativa para consultar los buses.",
      );
      return false;
    }
    return true;
  }

  function accessError(error) {
    if (error?.status === 401)
      view.signedOut("Tu sesión no está disponible o venció. Inicia sesión.");
    else if (error?.status === 403)
      view.blocked("No tienes permiso para consultar estos buses.");
    else if (error?.status === 404)
      view.notFound(
        "El bus o sus fotografías ya no están disponibles. Vuelve al inventario.",
      );
    else
      view.failed(
        "No pudimos cargar el inventario. Comprueba la conexión e inténtalo de nuevo.",
      );
  }

  async function start() {
    view.loading("Comprobando tu sesión…");
    try {
      if (!(await verifySession())) return;
      const busId = new URLSearchParams(location.search).get("id");
      if (busId) {
        await showDetails(busId);
        return;
      }
      const { buses } = (await client.request(BUSES)) ?? {};
      if (!Array.isArray(buses) || !buses.every(isBusSummary))
        throw new Error("La respuesta de buses no es válida.");
      view.showList(buses);
    } catch (error) {
      accessError(error);
    }
  }

  async function showDetails(busId) {
    const { bus } =
      (await client.request(`${BUSES}/${encodeURIComponent(busId)}`)) ?? {};
    if (!isBusDetails(bus) || bus.id.toLowerCase() !== busId.toLowerCase())
      throw new Error("La ficha del bus no está completa.");
    view.showDetails(bus);
  }

  return { start };
}

export { createBusInventoryController };
