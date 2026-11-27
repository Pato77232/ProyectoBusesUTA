export const LOGOUT_PATH = "/api/v1/auth/logout";
export const LOGIN_PAGE = "/pages/login.html";
const BUSY_LABEL = "Cerrando sesión…";

// FRONT-02 T12: cierre de sesión común para las páginas del personal.
// El backend revoca la sesión; la interfaz solo pide el cierre y sale.
export function createLogoutAction({ client, leave }) {
  let busy = false;
  return async function logout() {
    if (busy) return false;
    busy = true;
    try {
      await client.request(LOGOUT_PATH, { method: "POST" });
    } catch {
      // Una respuesta perdida no prueba el cierre; el login vuelve a comprobarlo.
    } finally {
      leave(LOGIN_PAGE);
    }
    return true;
  };
}

export function bindLogoutButtons({ buttons, client, leave }) {
  if (!buttons.length) return null;
  const logout = createLogoutAction({ client, leave });
  const onClick = () => {
    for (const button of buttons) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = BUSY_LABEL;
    }
    return logout();
  };
  for (const button of buttons) button.addEventListener("click", onClick);
  return onClick;
}
