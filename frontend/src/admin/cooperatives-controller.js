import { fetchCooperatives, paths, requireRole } from "./admin-core.js";

function validateCooperative({ name, ruc, email }) {
  if (typeof name !== "string" || !name.trim()) {
    return { field: "name", message: "Introduce el nombre de la cooperativa." };
  }
  if (typeof ruc !== "string" || !/^\d{13}$/u.test(ruc.trim())) {
    return {
      field: "ruc",
      message: "El RUC debe tener exactamente 13 dígitos.",
    };
  }
  if (email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email.trim())) {
    return {
      field: "email",
      message: "Introduce un correo válido o deja el campo vacío.",
    };
  }
  return null;
}

export function createCooperativesController({ client, view }) {
  let authorized = false;
  let busy = false;
  let uncertain = false;

  async function refresh() {
    try {
      const cooperatives = await fetchCooperatives(client);
      view.showCooperatives(cooperatives);
      view.notice(
        cooperatives.length
          ? "Catálogo actualizado."
          : "Todavía no hay cooperativas.",
      );
    } catch (error) {
      if (error?.status === 401) {
        authorized = false;
        view.deny("Tu sesión terminó. Inicia sesión de nuevo.");
      } else if (error?.status === 403) {
        authorized = false;
        view.deny("Esta cuenta no tiene acceso.");
      } else
        view.notice(
          "No pudimos cargar el catálogo. Puedes reintentar la consulta.",
        );
    }
  }

  async function start() {
    view.setBusy(true);
    try {
      const user = await requireRole(client, "SYSTEM_ADMIN");
      authorized = true;
      view.showAccess(user);
      await refresh();
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) {
        view.deny(
          error.status === 401
            ? "Tu sesión terminó. Inicia sesión de nuevo."
            : "Esta cuenta no tiene acceso a esta pantalla.",
        );
      } else {
        view.notice(
          "No pudimos comprobar tu sesión. Actualiza la página para reintentar.",
        );
      }
    } finally {
      view.setBusy(false);
    }
  }

  async function submit({ name, ruc, email, phone, address }) {
    if (!authorized || busy || uncertain) return;
    view.clearResult();
    const invalid = validateCooperative({ name, ruc, email });
    if (invalid) {
      view.invalid(invalid.field, invalid.message);
      return;
    }
    busy = true;
    view.setBusy(true);
    view.notice("Registrando cooperativa…");
    try {
      const result = await client.request(paths.cooperatives, {
        method: "POST",
        data: {
          name,
          ruc,
          email: email || null,
          phone: phone || null,
          address: address || null,
        },
      });
      const cooperative = result?.cooperative;
      if (
        typeof cooperative?.id !== "string" ||
        cooperative.ruc !== ruc.trim()
      ) {
        throw new Error("Respuesta de alta inválida.");
      }
      view.showCreated(cooperative);
      view.notice(
        "La cooperativa se registró. Ya puedes asignar su administrador.",
      );
      await refresh();
    } catch (error) {
      if (
        error?.status === 401 ||
        (error?.status === 403 && error?.code !== "CSRF_TOKEN_INVALID")
      ) {
        view.deny(
          "Tu sesión no permite esta operación. Inicia sesión con un administrador del sistema.",
        );
      } else if (error?.code === "COOPERATIVE_ALREADY_EXISTS") {
        view.notice(
          "Ya existe una cooperativa con ese RUC. Consulta el catálogo antes de repetir el alta.",
        );
      } else if (
        error?.status === 400 ||
        error?.code === "CSRF_TOKEN_INVALID"
      ) {
        view.notice("Revisa los datos y vuelve a intentarlo.");
      } else {
        uncertain = true;
        view.notice(
          "No pudimos confirmar el alta. Consulta el catálogo antes de repetirla.",
        );
        view.lockUncertain();
      }
    } finally {
      busy = false;
      view.setBusy(false);
    }
  }

  return { start, refresh, submit };
}
