const SESSION_PATH = "/api/v1/auth/me";
const COOPERATIVES_PATH = "/api/v1/cooperatives";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export async function requireRole(client, role) {
  const response = await client.request(SESSION_PATH);
  const user = response?.user;
  if (
    !user ||
    typeof user.email !== "string" ||
    typeof user.role !== "string"
  ) {
    throw new Error("Respuesta de sesión inválida.");
  }
  if (user.role !== role) throw { status: 403, code: "FORBIDDEN" };
  if (
    role === "COOPERATIVE_ADMIN" &&
    !UUID_PATTERN.test(user.cooperative_id || "")
  ) {
    throw new Error("Contexto de cooperativa inválido.");
  }
  return user;
}

export async function fetchCooperatives(client) {
  const result = await client.request(COOPERATIVES_PATH);
  if (!Array.isArray(result?.cooperatives))
    throw new Error("Catálogo inválido.");
  const ids = new Set();
  for (const cooperative of result.cooperatives) {
    if (
      !UUID_PATTERN.test(cooperative?.id || "") ||
      typeof cooperative.name !== "string" ||
      !cooperative.name.trim() ||
      typeof cooperative.ruc !== "string" ||
      !/^\d{13}$/u.test(cooperative.ruc) ||
      ids.has(cooperative.id)
    ) {
      throw new Error("Catálogo inválido.");
    }
    ids.add(cooperative.id);
  }
  return result.cooperatives;
}

export function validateAccount({ email, password, confirmation }) {
  const normalizedEmail = typeof email === "string" ? email.trim() : "";
  if (normalizedEmail.length > 254 || !EMAIL_PATTERN.test(normalizedEmail)) {
    return {
      field: "email",
      message: "Introduce un correo electrónico válido.",
    };
  }
  const length = typeof password === "string" ? [...password].length : 0;
  if (length < 15 || length > 128) {
    return {
      field: "password",
      message: "La contraseña debe tener entre 15 y 128 caracteres.",
    };
  }
  if (password !== confirmation) {
    return { field: "confirmation", message: "Las contraseñas no coinciden." };
  }
  return null;
}

export function accountError(error) {
  if (error?.status === 401)
    return {
      access: true,
      message: "Tu sesión terminó. Inicia sesión de nuevo.",
    };
  if (error?.status === 403 && error?.code !== "CSRF_TOKEN_INVALID") {
    return {
      access: true,
      message: "Esta cuenta no tiene acceso a esta pantalla.",
    };
  }
  if (error?.code === "CSRF_TOKEN_INVALID") {
    return { message: "La solicitud venció. Vuelve a intentarlo." };
  }
  if (error?.code === "REGISTRATION_CONFLICT") {
    return {
      message:
        "No se pudo crear la cuenta: el correo o el cargo ya están ocupados.",
    };
  }
  if (error?.status === 400)
    return { message: "Revisa los datos e inténtalo de nuevo." };
  if (error?.status === 404)
    return { message: "La cooperativa ya no existe. Actualiza el catálogo." };
  return {
    uncertain: true,
    message:
      "No pudimos confirmar si la cuenta se creó. Compruébalo con la administración antes de repetir el alta.",
  };
}

export const paths = { cooperatives: COOPERATIVES_PATH };
