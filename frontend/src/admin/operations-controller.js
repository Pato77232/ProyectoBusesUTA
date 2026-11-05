const SESSION_PATH = "/api/v1/auth/me";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isCooperativeAdmin(user) {
  return (
    user?.role === "COOPERATIVE_ADMIN" &&
    typeof user.email === "string" &&
    UUID_PATTERN.test(user.id || "") &&
    UUID_PATTERN.test(user.cooperative_id || "")
  );
}

export function createCooperativeOperationsController({ client, view }) {
  async function start() {
    view.render({
      mode: "checking",
      message: "Comprobando tu sesión…",
    });

    try {
      const { user } = (await client.request(SESSION_PATH)) ?? {};
      if (user?.role !== "COOPERATIVE_ADMIN") {
        view.render({
          mode: "forbidden",
          message: "Esta pantalla es solo para administradores de cooperativa.",
        });
        return;
      }
      if (!isCooperativeAdmin(user)) {
        view.render({
          mode: "error",
          message:
            "No pudimos verificar los datos de tu cuenta. Inicia sesión de nuevo.",
        });
        return;
      }
      view.render({
        mode: "ready",
        message: `Sesión de cooperativa: ${user.email}`,
      });
    } catch (error) {
      const message =
        error?.status === 401
          ? "Tu sesión terminó o no está disponible. Inicia sesión de nuevo."
          : error?.status === 403
            ? "Esta cuenta no tiene permiso para ver las operaciones de cooperativa."
            : "No pudimos comprobar tu sesión. Revisa la conexión e inténtalo de nuevo.";
      view.render({
        mode: error?.status === 401 ? "signed-out" : "error",
        message,
      });
    }
  }

  return { start };
}
