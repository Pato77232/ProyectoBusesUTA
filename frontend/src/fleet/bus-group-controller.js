const SESSION = "/api/v1/auth/me";
const BUS_GROUPS = "/api/v1/bus-groups";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// RN-11: las tres categorías operativas de FLEET-01.
export const BUS_GROUP_CATEGORIES = Object.freeze([
  Object.freeze({ value: "LONG_ROUTE", label: "Rutas largas (alto confort)" }),
  Object.freeze({ value: "CANTONAL", label: "Rutas cantonales (estándar)" }),
  Object.freeze({ value: "URBAN_RURAL", label: "Rutas urbanas o rurales" }),
]);
const CATEGORY_VALUES = BUS_GROUP_CATEGORIES.map((category) => category.value);

export function categoryLabel(value) {
  return (
    BUS_GROUP_CATEGORIES.find((category) => category.value === value)?.label ??
    value
  );
}

function isAdmin(user) {
  return (
    user?.role === "COOPERATIVE_ADMIN" &&
    UUID.test(user.id ?? "") &&
    UUID.test(user.cooperative_id ?? "")
  );
}

function isBusGroup(group) {
  return (
    UUID.test(group?.id ?? "") &&
    typeof group.name === "string" &&
    CATEGORY_VALUES.includes(group.category)
  );
}

const REJECTIONS = Object.freeze({
  BUS_GROUP_ALREADY_EXISTS:
    "Ya existe un grupo con ese nombre en tu cooperativa. Usa otro nombre.",
  VALIDATION_ERROR: "Revisa el nombre y la categoría del grupo.",
});

export function createBusGroupController({ client, view }) {
  let busy = false;

  function accessError(error) {
    if (error?.status === 401)
      view.signedOut("Tu sesión no está disponible o venció. Inicia sesión.");
    else if (error?.status === 403)
      view.blocked("No tienes permiso para administrar grupos de buses.");
    else
      view.failed(
        "No pudimos cargar los grupos. Comprueba la conexión e inténtalo de nuevo.",
      );
  }

  async function loadGroups() {
    const { busGroups } = (await client.request(BUS_GROUPS)) ?? {};
    if (!Array.isArray(busGroups) || !busGroups.every(isBusGroup)) {
      view.failed(
        "La lista de grupos recibida no es válida. Inténtalo de nuevo.",
      );
      return false;
    }
    view.groups(busGroups);
    return true;
  }

  async function start() {
    view.loading("Comprobando tu sesión…");
    try {
      const { user } = (await client.request(SESSION)) ?? {};
      if (!isAdmin(user)) {
        view.blocked(
          "Necesitas una sesión de administrador de cooperativa para administrar grupos de buses.",
        );
        return;
      }
      if (await loadGroups()) view.ready();
    } catch (error) {
      accessError(error);
    }
  }

  async function create({ name, category }) {
    if (busy) return;
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (!trimmed)
      return view.status("Escribe un nombre para el grupo.", "error");
    if (!CATEGORY_VALUES.includes(category))
      return view.status("Elige la categoría del grupo.", "error");
    busy = true;
    view.busy(true);
    view.status("Creando el grupo…", "info");
    try {
      const { busGroup } =
        (await client.request(BUS_GROUPS, {
          method: "POST",
          data: { name: trimmed, category },
        })) ?? {};
      if (!isBusGroup(busGroup)) {
        view.status(
          "No pudimos confirmar el alta. Actualiza la lista antes de intentarlo otra vez.",
          "error",
        );
        return;
      }
      view.created(busGroup);
      await loadGroups();
      view.status(`Grupo «${busGroup.name}» creado.`, "success");
    } catch (error) {
      if ([401, 403].includes(error?.status)) accessError(error);
      else
        view.status(
          REJECTIONS[error?.code] ??
            "No se pudo crear el grupo. Inténtalo de nuevo más tarde.",
          "error",
        );
    } finally {
      busy = false;
      view.busy(false);
    }
  }

  return { start, create };
}
