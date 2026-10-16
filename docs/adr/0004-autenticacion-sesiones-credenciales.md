# ADR 0004: Autenticación, sesiones y credenciales

- **Estado:** Aceptada (equipo, octubre 2026)
- **Fecha:** 2026-10
- **Decidido por:** equipo (acuerdos confirmados por el responsable del módulo `auth`)

## Contexto
La plataforma multi-tenant necesita autenticar a usuarios con distintos roles (RN-01) y entregar al servidor un `cooperative_id` verificable (RN-02, ADR 0002). La primera entrega debe ser simple pero no sacrificar invalidación de sesiones ni protección CSRF.

## Decisión

### Acceso
- **JWT con access token, sin refresh token** en la primera entrega.
- Duración configurable por `JWT_EXPIRES_IN`; valor inicial **30 minutos**.
- El token viaja en **cookie `HttpOnly`**, `SameSite=Lax`, `Secure` cuando la petición es HTTPS. El desarrollo local puede usar HTTP; el despliegue debe usar HTTPS.
- Claims: `sub`, `role`, `cooperative_id` (nullable), `sid`, `iat`, `exp`.

### Sesiones revocables
- Cada login crea un registro en **`auth_sessions`** con id igual al `sid` del JWT, `user_id`, `expires_at` y `revoked_at` opcional.
- El servidor verifica la sesión en cada petición protegida (complemento de AUTH-02); cerrar sesión invalida el registro en servidor además de borrar la cookie (AUTH-03).

### Protección CSRF
- Mecanismo **double-submit**: `GET /api/v1/auth/csrf` entrega un token que el cliente devuelve en la cabecera `X-CSRF-Token` en el login y en **todas** las operaciones que modifican datos.
- `SameSite=Lax` es una defensa adicional, **no** la única protección.

### Credenciales
- Identificador de acceso: **email**, normalizado (`trim` + minúsculas); unicidad sobre la forma normalizada. La cédula no se define como identificador en esta fase.
- Hash: **Argon2id** con parámetros: `m=19456` KiB, `t=2`, `p=1`, sal de 16 bytes aleatorios, resumen de 32 bytes.
- Política de contraseña: 15–128 caracteres, espacios permitidos, sin exigir combinaciones arbitrarias.
- Mensajes de error genéricos; no se revela si una cuenta existe.

### Límites de intentos (valores iniciales configurables)
- **5** intentos fallidos por cuenta y **20** por IP en ventana de **15** minutos; bloqueo de **15** minutos.
- Almacenamiento **en memoria**: válido solo para **una instancia** y se pierde al reiniciar el servidor. **No** es compatible con despliegues multi-instancia; si el despliegue crece, se sustituirá por almacenamiento compartido (BD o Redis) en una tarea propia.

### Roles y cooperativa
- Un usuario tiene **exactamente un rol**: columna `role` con restricción CHECK.
- `cooperative_id` es **nullable** para Cliente y Administrador del Sistema, y **obligatorio** para los roles internos de cooperativa. Sin cooperativa ficticia.
- Antes de crear usuarios internos de cooperativa debe existir la tabla `cooperativas` con **FK** desde `users.cooperative_id` y la validación de obligatoriedad por rol (seguimiento en `docs/specs/AUTH-01.md`).

## Alternativas consideradas
- **Sesiones de servidor (`express-session`):** invalidación natural, pero acopla el estado a la instancia y contradice el uso de JWT ya previsto; se optó por JWT + registro de sesiones revocables.
- **Refresh token:** más complejidad para la primera entrega; se pospone.
- **Solo `SameSite` contra CSRF:** insuficiente como única defensa.
- **bcrypt:** alternativa válida, pero se eligió Argon2id por su resistencia recomendada actualmente.
- **Límites de intentos en BD desde el inicio:** evita el problema multi-instancia, pero agrega una tabla y consultas al login; se pospone hasta que exista un despliegue real con varias instancias.

## Consecuencias
- Login y logout fuertes sin refresh token; la renovación de acceso implica volver a iniciar sesión.
- El registro `auth_sessions` es la base de la invalidación y de la comprobación por petición.
- El límite de intentos debe revisarse antes de cualquier despliegue con más de una instancia.
- Las specs de `auth` (AUTH-01 a AUTH-04) detallan criterios y pruebas; los ADR 0001–0003 quedan aceptados por el equipo.
