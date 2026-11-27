import { loginDestination } from "./login-view.js";

const SESSION_PATH = "/api/v1/auth/me";

// FRONT-02 T11: enlace de cabecera según la sesión. Solo es presentación:
// el backend sigue validando rol y cooperativa en cada operación.
export function sessionLinkFor(user) {
  if (typeof user?.email !== "string" || !user.email) return null;
  const destination = loginDestination(user.role);
  return destination
    ? { href: destination.href, label: destination.label }
    : null;
}

export async function updateSessionLinks({ client, links, guestOnly = [] }) {
  if (!links.length) return null;
  let user = null;
  try {
    ({ user } = (await client.request(SESSION_PATH)) ?? {});
  } catch {
    // Sin sesión o sin respuesta, se conserva «Iniciar sesión».
    return null;
  }
  const target = sessionLinkFor(user);
  if (!target) return null;
  for (const link of links) {
    link.href = target.href;
    link.textContent = target.label;
  }
  for (const element of guestOnly) element.hidden = true;
  return target;
}
