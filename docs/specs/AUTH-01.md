# AUTH-01: Iniciar sesión con un usuario existente

- **ID local:** AUTH-01
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** `auth`
- **Responsable:** Pablo
- **Estado:** Aprobada (especificación). **Implementación autorizada por Pablo en esta sesión**

> Decisiones **aprobadas por el equipo** (octubre 2026) y registradas en ADR 0004 (aceptada). La compra como **invitado** (RN-41) no es un login de invitado y queda **fuera** de estas specs de autenticación; su pregunta abierta se conserva en `docs/business-rules.md`.

## 1. Objetivo
Permitir que un usuario con cuenta (cualquiera de los roles del sistema) inicie sesión con email y contraseña y obtenga un acceso verificable en el servidor. Es la primera pieza de autenticación; las specs AUTH-02 (autorización en rutas protegidas), AUTH-03 (cerrar sesión) y AUTH-04 (registrar Cliente) la consumen.

## 2. Reglas de negocio involucradas
- RN-01: cada usuario tiene exactamente un rol; el rol viaja en el token pero el servidor lo re-verifica.
- RN-02: el `cooperative_id` del usuario proviene del token emitido por el servidor, nunca de la petición del navegador.

## 3. Alcance
**Incluye:** entrega de token CSRF (double-submit), endpoint de login, validación de credenciales con Argon2id, emisión de JWT (access token sin refresh) en cookie `HttpOnly`, registro de sesión revocable (`sid`) en base de datos, límites de intentos fallidos por cuenta e IP, mensajes que no revelan existencia de cuentas.
**No incluye:** registro de Cliente (AUTH-04), middleware de autenticación/autorización para el resto de rutas y protección CSRF de esas rutas (AUTH-02), invalidación en servidor al cerrar sesión (AUTH-03), altas de administradores/oficinistas (specs posteriores; condicionadas por la FK de `cooperative_id`, ver §7), recuperación de contraseña, verificación de correo, MFA (pendientes de acordar; no se incluyen automáticamente).

## 4. Decisiones aprobadas por el equipo (octubre 2026)
| Tema | Decisión |
|---|---|
| Mecanismo | JWT con **access token**, sin refresh token en la primera entrega |
| Duración | Configurable por `JWT_EXPIRES_IN`, inicialmente **30 minutos** |
| Almacenamiento del token | Cookie `HttpOnly`, `SameSite=Lax`, `Secure` cuando la petición sea HTTPS. Desarrollo local puede ser HTTP; el despliegue debe usar HTTPS |
| Invalidación | El logout real (AUTH-03) invalidará en servidor; por eso AUTH-01 **emite el token con `sid`** y crea un registro en `auth_sessions` desde el primer login |
| CSRF | Mecanismo **double-submit** obligatorio también en el login (§5). `SameSite=Lax` es defensa adicional, **no** protección suficiente por sí sola |
| Identificador de acceso | **Email**, normalizado (`trim` + minúsculas) antes de comparar y almacenar; unicidad sobre la forma normalizada. La cédula **no** se decide aquí (relación con pasajeros/clientes pendiente) |
| Contraseña | **Argon2id**; longitud 15–128 caracteres, espacios permitidos, sin exigir combinaciones arbitrarias de mayúsculas/números/símbolos. Parámetros: ver §9 |
| Límites de intentos | Por cuenta: **5** fallos en ventana de **15** min → bloqueo **15** min. Por IP: **20** fallos en ventana de **15** min → bloqueo **15** min. Configurables (`LOGIN_MAX_ATTEMPTS_PER_ACCOUNT`, `LOGIN_ATTEMPT_WINDOW_MINUTES`, `LOGIN_ACCOUNT_LOCK_MINUTES`, `LOGIN_MAX_ATTEMPTS_PER_IP`). **Almacenamiento en memoria:** válido solo para **una instancia** y se **pierde al reiniciar el servidor**. **No** es compatible con despliegues multi-instancias; sustituirlo por BD o Redis es una tarea futura explícita antes de escalar horizontalmente |
| Verificación de cuenta inexistente | Respuesta **idéntica** a contraseña incorrecta y, para reducir diferencias de tiempo, se ejecuta una verificación Argon2id ficticia cuando el email no existe |
| Roles y cooperativa | Columna `role` con restricción CHECK (exactamente un rol). `cooperative_id` **nullable** para Cliente y Administrador del Sistema; obligatorio para roles internos de cooperativa. Sin cooperativa ficticia. La obligatoriedad por rol se valida en las specs de cada alta; AUTH-01 solo hace login |
| Revisión del token | El servidor **nunca** confía en valores enviados por el navegador; AUTH-02 verificará sesión, usuario, rol y cooperativa en cada petición protegida |

## 5. Protección CSRF (obligatoria en el login)
Mecanismo **double-submit**:
1. `GET /api/v1/auth/csrf` genera un token aleatorio (32 bytes), lo devuelve en el cuerpo `{ "csrfToken": "..." }` y lo envía en la cookie `csrf_token` (**sin** `HttpOnly`, `SameSite=Lax`, `Secure` en HTTPS, `Max-Age=600`).
2. El cliente devuelve el mismo valor en la cabecera **`X-CSRF-Token`** en el login y, más adelante (AUTH-02), en toda operación que modifica datos.
3. El servidor exige coincidencia exacta entre cabecera y cookie; si falta o no coincide, responde **403** con código `CSRF_TOKEN_INVALID`. No se procesan credenciales sin superar esta comprobación.
4. El token es un valor aleatorio sin estado en el servidor (double-submit); su confianza se apoya en que el navegador de otro origen no puede leer la cookie. `SameSite=Lax` se mantiene como capa adicional, jamás como única defensa.

## 6. Flujo principal
1. El cliente llama a `GET /api/v1/auth/csrf` y recibe el token.
2. El cliente envía `POST /api/v1/auth/login` con `email`, `password` y cabecera `X-CSRF-Token`.
3. El servidor valida el CSRF (§5); después normaliza el email (`trim` + minúsculas) y aplica los límites de intentos por cuenta e IP.
4. Busca el usuario; si no existe, ejecuta una verificación Argon2id ficticia y responde igual que con contraseña incorrecta.
5. Verifica la contraseña con Argon2id; en fallo, registra el intento y responde genérico.
6. Crea el registro en `auth_sessions` y emite el JWT en cookie `HttpOnly`.
7. Responde 200 sin cuerpo sensible (el token vive solo en la cookie).

## 7. Datos y migraciones (parte de AUTH-01)
**`users`** (esquema mínimo para login; altas de clientes en AUTH-04 y altas internas en specs posteriores)
| Campo | Tipo | Restricción |
|---|---|---|
| id | UUID | PK, `gen_random_uuid()` |
| email | TEXT | NOT NULL, normalizado, **único** |
| password_hash | TEXT | NOT NULL (Argon2id) |
| role | TEXT | NOT NULL, CHECK en (`SYSTEM_ADMIN`, `COOPERATIVE_ADMIN`, `CLERK`, `CUSTOMER`) |
| cooperative_id | UUID | NULL para `SYSTEM_ADMIN` y `CUSTOMER`; **sin FK todavía** (seguimiento en §8) |
| created_at / updated_at | timestamptz | NOT NULL |

**`auth_sessions`** (registro de sesiones revocables)
| Campo | Tipo | Restricción |
|---|---|---|
| id | UUID | PK (es el `sid` del JWT) |
| user_id | UUID | NOT NULL, FK → `users.id` |
| created_at | timestamptz | NOT NULL |
| expires_at | timestamptz | NOT NULL (misma vigencia que el JWT) |
| revoked_at | timestamptz | NULL (lo usará AUTH-03) |
| revoke_reason | TEXT | NULL |

**JWT (claims):** `sub`, `role`, `cooperative_id` (nullable), `sid`, `iat`, `exp`. Sin refresh token.

**Parámetros Argon2id (aprobados, sin ambigüedad):** `m=19456` KiB (19 MiB), `t=2`, `p=1`, sal aleatoria de **16 bytes**, resumen de **32 bytes**. Constantes con nombre en el código, no números mágicos.

### Seguimiento de la integridad de `cooperative_id`
La columna queda **sin FK** en la migración de AUTH-01 porque la tabla `cooperatives` aún no existe. El seguimiento es obligatorio y está definido:
1. **TENANTS-01** (spec por redactar, responsable Pablo): crea la tabla `cooperatives`.
2. **AUTH-FK-01** (tarea de migración, prerequisito de AUTH-05 y AUTH-06): agrega `FK users.cooperative_id → cooperatives.id` y la validación de obligatoriedad por rol (`COOPERATIVE_ADMIN` y `CLERK` exigen `cooperative_id` NOT NULL; `SYSTEM_ADMIN` y `CUSTOMER` exigen NULL).
3. **Regla de puerta:** ninguna spec que cree usuarios `COOPERATIVE_ADMIN` o `CLERK` puede implementarse antes de que AUTH-FK-01 esté fusionada. Se verifica en la revisión de esas specs.

## 8. Endpoints
| Método | Ruta | Roles | Respuestas |
|---|---|---|---|
| GET | /api/v1/auth/csrf | Público (sin token) | 200 |
| POST | /api/v1/auth/login | Público (sin token) + `X-CSRF-Token` válido | 200, 400, 401, 403, 429 |

**Matriz de permisos (parcial; la matriz compartida completa se crea con AUTH-02):** ambos endpoints son de acceso público y no otorgan permisos de escritura sobre datos de cooperativa.

## 9. Datos de entrada
| Campo | Tipo | Validación |
|---|---|---|
| email | texto | obligatorio, formato de email, se normaliza |
| password | texto | obligatorio, 15–128 caracteres (sin recortar espacios) |

## 10. Criterios de aceptación
- [ ] Dado el token CSRF de `GET /api/v1/auth/csrf`, cuando se envía el login con la cabecera `X-CSRF-Token` correcta, entonces el CSRF se acepta y el flujo continúa.
- [ ] Dado un login sin cabecera `X-CSRF-Token` o con una que no coincide con la cookie, entonces recibe 403 con código `CSRF_TOKEN_INVALID` y **no** se evalúan credenciales.
- [ ] Dado un usuario existente y su contraseña correcta, cuando envía el login, entonces recibe 200, la cookie del token es `HttpOnly` y `SameSite=Lax`, y existe una fila en `auth_sessions` con `sid` igual al del JWT.
- [ ] Dada una contraseña incorrecta, cuando envía el login, entonces recibe 401 con código `INVALID_CREDENTIALS`.
- [ ] Dado un email inexistente, cuando envía el login, entonces la respuesta (código y mensaje) es **idéntica** a la de contraseña incorrecta.
- [ ] Dado un email con mayúsculas o espacios alrededor, cuando envía el login, entonces se compara en forma normalizada y el login puede tener éxito.
- [ ] Dados 5 intentos fallidos consecutivos de la misma cuenta, cuando envía un sexto intento antes del bloqueo, entonces recibe 429 con código `TOO_MANY_ATTEMPTS` (valores configurables).
- [ ] Dados 20 intentos fallidos desde la misma IP con cuentas distintas, cuando se supera el límite, entonces se recibe 429 aunque la cuenta no esté bloqueada.
- [ ] Reiniciado el servidor, entonces los contadores de intentos se restablecen (limitación documentada de `LOGIN_RATE_LIMIT_STORE=memory`).
- [ ] Dado un cuerpo sin `email` o sin `password`, o con password fuera de rango, entonces recibe 400 con código `VALIDATION_ERROR`.
- [ ] Ninguna respuesta ni log revela si el email existe o cuál campo falló.
- [ ] El rol y el `cooperative_id` del token se toman de la base de datos, nunca del cuerpo de la petición.
- [ ] En HTTPS, la cookie lleva `Secure`; en HTTP local no rompe el desarrollo.
- [ ] Los parámetros Argon2id usados coinciden con §7 (`m=19456`, `t=2`, `p=1`, sal 16 B, resumen 32 B).

## 11. Casos borde y errores
- Cuenta con email duplicado en distinta capitalización (imposible gracias a la unicidad normalizada).
- JWT_SECRET ausente o vacío: el servidor no arranca (error de configuración explícito).
- Consumo del límite con intentos intercalados de varias cuentas desde la misma IP.
- Duración de token distinta de la del registro de sesión (misma vigencia: se derivan de la misma configuración).
- Cookie `csrf_token` ausente o manipulada al enviar el login.

## 12. Pruebas esperadas
- Unitarias (`backend/tests/unit/auth/`): `LoginUseCase` con repositorio y hasher simulados (éxito, contraseña incorrecta, email inexistente, bloqueo por cuenta, bloqueo por IP); normalización de email; validación de CSRF; creación de `auth_session` con vigencia calculada.
- Integración (`backend/tests/integration/auth/`): endpoints reales contra `pasajes_test`; 403 por CSRF faltante o incorrecto; banderas de cookie; igualdad de respuestas para email inexistente vs contraseña incorrecta; 429 tras los límites configurados y reinicio de contadores; fila en `auth_sessions`; claims del JWT.
- Datos ficticios solo en pruebas/desarrollo; placeholders en documentación; nunca credenciales reales ni predeterminadas de producción.

## 13. Preguntas abiertas
- Estrategia de almacenamiento de límites de intentos si el despliegue pasa a varias instancias (BD o Redis) — fuera de AUTH-01; condición para escalar horizontalmente.
- Relación cédula ↔ unicidad global (con reglas de pasajeros/clientes, no aquí).
- Recuperación de contraseña, verificación de correo y MFA: pendientes de acordar, fuera de AUTH-01.
- Compra como invitado (RN-41, pregunta abierta 8 de `business-rules.md`): fuera del alcance del login.

## 14. Dependencias con otras specs
- **Requiere:** INFRA-01 (esqueleto, Express, migraciones, Jest/ESLint, BD de pruebas).
- **Provee a:** AUTH-02 (cookie, `auth_sessions`, claims, endpoints CSRF), AUTH-03 (registro revocable y `sid`), AUTH-04 (tabla `users`, hash Argon2id).
- **Condiciona:** AUTH-05 y AUTH-06 (altas internas de cooperativa) requieren previamente **TENANTS-01** (`cooperatives`) y **AUTH-FK-01** (FK + obligatoriedad por rol), ver §7.
- AUTH-02 tiene otro número, pero puede implementarse en paralelo a AUTH-03/04 tras AUTH-01; el orden no es correlativo al número.

## 15. Defecto inducido (solo si aplica)
**No aplica.** AUTH-01 no introduce defectos académicos ni vulnerabilidades de autenticación. La entrega incluirá defectos inducidos definidos y autorizados por separado según `docs/errores-inducidos.md`.

## Precisiones de implementación
- Double-submit firmado con HMAC-SHA256, nonce de 32 bytes, vigencia de 600 segundos y comparación constante. Se liga a una cookie de navegador HttpOnly y al sid cuando existe JWT válido; obtener un nuevo CSRF después de login/logout. Se conserva la cookie csrf_token y la cabecera X-CSRF-Token. El formato firmado amplía el token aleatorio original; evita aceptar cookies arbitrarias coincidentes.
- JWT HS256, cookie access_token con Path=/, sin Domain. JWT_SECRET exige al menos 32 caracteres. TRUST_PROXY solo habilita proxy de loopback explícito; no confiar globalmente en X-Forwarded-For.
- Login 200 sin cuerpo, registro 201 sin cuerpo. Configuración JWT_EXPIRES_IN acepta enteros con unidad s/m/h; no unidades implícitas.
- La memoria de intentos contabiliza también verificaciones en curso para impedir eludir el límite mediante concurrencia. Libera el intento en éxito/error técnico; éxito reinicia fallos de la cuenta. Entradas vencidas se depuran y existe límite de capacidad para memoria.
- Dependencias: pg/node-pg-migrate (persistencia/migraciones), argon2 (hash aprobado), jsonwebtoken (firma/verificación HS256), zod (validación HTTP). Versiones exactas en package-lock.json.

## Cierre de implementación
Implementada y verificada en esta rama. Evidencia y guía: `docs/autenticacion-ejecucion.md`. Sin defectos inducidos. La revisión humana del PR y su integración siguen pendientes.
