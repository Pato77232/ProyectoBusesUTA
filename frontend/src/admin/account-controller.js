import {
  accountError,
  fetchCooperatives,
  requireRole,
  validateAccount,
} from "./admin-core.js";

export function createAccountController({
  client,
  view,
  kind,
  requestedCooperativeId = null,
}) {
  const isAdmin = kind === "administrator";
  const role = isAdmin ? "SYSTEM_ADMIN" : "COOPERATIVE_ADMIN";
  let authorized = false;
  let busy = false;
  let uncertain = false;
  let cooperatives = [];
  let actor = null;

  async function start() {
    view.setBusy(true);
    try {
      const user = await requireRole(client, role);
      actor = user;
      authorized = true;
      view.showAccess(user);
      if (isAdmin) {
        cooperatives = await fetchCooperatives(client);
        const selected = cooperatives.some(
          (item) => item.id === requestedCooperativeId,
        )
          ? requestedCooperativeId
          : null;
        view.showCooperatives(cooperatives, selected);
      }
      view.notice(
        isAdmin && !cooperatives.length
          ? "No hay cooperativas registradas."
          : "Completa los datos de la cuenta.",
      );
    } catch (error) {
      const result = accountError(error);
      if (result.access) {
        authorized = false;
        view.deny(result.message);
      } else {
        uncertain = true;
        view.notice(
          "No pudimos cargar los datos. Actualiza la página para reintentar.",
        );
      }
    } finally {
      view.setBusy(false);
      if (uncertain) view.lockUncertain();
    }
  }

  async function submit({ cooperativeId, email, password, confirmation }) {
    if (!authorized || busy || uncertain) return;
    view.clearResult();
    if (isAdmin && !cooperatives.some((item) => item.id === cooperativeId)) {
      view.invalid("cooperative", "Selecciona una cooperativa del catálogo.");
      return;
    }
    const invalid = validateAccount({ email, password, confirmation });
    if (invalid) {
      view.clearSecrets();
      view.invalid(invalid.field, invalid.message);
      return;
    }
    const path = isAdmin
      ? `/api/v1/cooperatives/${cooperativeId}/admins`
      : "/api/v1/auth/clerks";
    busy = true;
    view.setBusy(true);
    view.notice("Creando la cuenta…");
    try {
      const result = await client.request(path, {
        method: "POST",
        data: { email, password },
      });
      if (
        result?.user?.email !== email.trim().toLowerCase() ||
        result.user.role !== (isAdmin ? "COOPERATIVE_ADMIN" : "CLERK") ||
        result.user.cooperative_id !==
          (isAdmin ? cooperativeId : actor.cooperative_id)
      ) {
        throw new Error("Respuesta de alta inválida.");
      }
      view.showResult(result.user);
      view.notice("La cuenta se creó correctamente. Ya puede iniciar sesión.");
    } catch (error) {
      const result = accountError(error);
      uncertain = Boolean(result.uncertain);
      if (result.access) {
        authorized = false;
        view.deny(result.message);
      } else view.notice(result.message);
    } finally {
      view.clearSecrets();
      busy = false;
      view.setBusy(false);
      if (uncertain) view.lockUncertain();
    }
  }

  return { start, submit };
}
