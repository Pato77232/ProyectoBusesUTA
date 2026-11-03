import { ApiError } from "../api/api-error.js";

export function createBookingAccess({ api }) {
  let busy = false;
  return {
    get state() {
      return Object.freeze({ busy });
    },
    async signIn(credentials) {
      if (busy)
        throw new ApiError("ACCESS_BUSY", "Espera a que termine el acceso.");
      busy = true;
      try {
        await api.signIn({
          email: credentials.email,
          password: credentials.password,
        });
        const result = await api.session();
        const user = result?.user;
        if (typeof user?.id !== "string" || !user.id.trim()) {
          throw new ApiError(
            "RESPONSE_INVALID",
            "No se pudo verificar la sesión iniciada.",
          );
        }
        if (user.role !== "CUSTOMER" || user.cooperative_id !== null) {
          throw new ApiError(
            "FORBIDDEN",
            "Esta pantalla requiere una cuenta de cliente.",
            403,
          );
        }
        return Object.freeze({ authenticated: true });
      } finally {
        busy = false;
      }
    },
  };
}
