# AUTH-06: Crear oficinista de cooperativa

- **ID local:** AUTH-06; sin ticket externo.
- **Responsable:** Pablo. **Revisora confirmada:** Shirley.
- **Estado:** Cerrada; revisión humana e integración comprobadas en la PR #53.
- **Base de implementación:** `origin/develop` `1dcbd6d`, consultada el 2 de noviembre de 2026.
- **Autorización:** Pablo pidió preparar estas dependencias; aceptación de Shirley
  reportada por Pablo. No equivale a aprobar el contrato técnico completo.
- **Referencias:** [RN-01/02/03](../business-rules.md), [AUTH-05](AUTH-05.md),
  [ADR 0004](../adr/0004-autenticacion-sesiones-credenciales.md), [acuerdos](../dependencias-pagos.md).

## Objetivo y alcance confirmado

COOPERATIVE_ADMIN crea una cuenta CLERK nueva de su propia cooperativa para
operar Pagos. Body solo email/password; rol asignado por backend y cooperativa
obtenida de identidad autenticada y verificada. CSRF obligatorio. No se permite
SYSTEM_ADMIN como autoridad alternativa para este caso de uso.
Fuera: conversión de cuentas existentes, cambio de rol, desactivación, recuperación,
verificación de correo, envío de contraseñas, pantalla y login automático.

## Contrato técnico aplicado

POST /api/v1/auth/clerks, sesión válida COOPERATIVE_ADMIN y CSRF.
Reutilizar credentials.js: objeto estricto, email normalizado de hasta 254,
password de 15–128 puntos de código sin trim. Rechazar role/cooperative_id y
cualquier campo extra. No aceptar cooperativa por ruta o cabecera elegida.
201 {user:{id,email,role,cooperative_id}}, Cache-Control: no-store, sin contraseña,
hash, cookie de sesión nueva ni datos privados. Validar coherencia con publicUser.
400 VALIDATION_ERROR; 401 por sesión inválida; 403 por rol/CSRF, según errores
existentes de Auth; 409 REGISTRATION_CONFLICT genérico para email duplicado.
Cooperativa eliminada concurrentemente: la FK rechaza la inserción y Auth devuelve
`COOPERATIVE_NOT_FOUND` (404), como en AUTH-05, sin filtrar SQL. Una identidad
inconsistente se rechaza durante `authenticate`, antes del caso de uso.

## Diseño y datos

Caso de uso independiente en application con repository/hasher inyectados;
normalización/identidad en domain, Argon2id según ADR. Puerto pequeño para crear
CLERK, implementación PostgreSQL con consultas parametrizadas. HTTP solo valida,
autoriza y traduce. No importar internos de tenants/payments; composición por
index.js y server.js. Reutilizar users, FK e índice único de email si sus
restricciones admiten el rol; verificarlo antes de programar. Si hiciera falta
esquema, crear migración nueva, nunca editar las publicadas.

## Criterios y pruebas previstas

- [x] Alta correcta persiste hash, CLERK y cooperativa de sesión; login posterior
      devuelve esa identidad, sin iniciar sesión automáticamente al crearla.
- [x] Rechazar CUSTOMER, CLERK, SYSTEM_ADMIN y sesión ausente/vencida/revocada.
- [x] Rechazar CSRF inválido, campos extra y credenciales inválidas sin escritura.
- [x] Email duplicado normalizado y dos altas simultáneas crean como máximo una cuenta.
- [x] No crear/modificar cuentas en otra cooperativa, aunque se manipule el body.
- [x] QA aislado: identidades ficticias; contraseña no se guarda ni comparte en
      Git, specs, logs, capturas o chats. Guardar solo hash en BD de prueba.
- [x] Sin secretos en respuestas, registros o errores.

Unitarias del caso de uso y contratos; integración HTTP/PostgreSQL real con
sesión y CSRF; regresión Auth existente. Ejecutar lint, format:check y npm test
según testing-database.md; verificar arranque real si cambia composición.

## Plan pequeño y pendientes

1. Caso de uso, repositorio y ruta implementados en la rama de AUTH-06.
2. Pruebas locales completadas; solicitar revisión humana de Shirley antes de integrar.
No introducir límites de cantidad de CLERK ni reglas de contraseña nuevas por inferencia.
SOLID: responsabilidad única e inyección proporcional; sin interfaz en este alcance.
Usabilidad: errores consistentes permitirán explicar el resultado sin revelar
cuentas ajenas; no se acredita pantalla ni accesibilidad visual.
Defecto inducido: ninguno autorizado. Asistencia de Codex; revisión humana,
integración de AUTH-06 pendiente.

## Evidencia local — 2 de noviembre de 2026

- Base `origin/develop` `1dcbd6d`; rama `feature/AUTH-06-crear-oficinista`.
- `npm run lint`: aprobado. Prettier explícito de los seis JavaScript cambiados:
  aprobado. `npm run format:check`: falló en 17 archivos preexistentes de hojas de
  ruta/migraciones, ninguno modificado por AUTH-06.
- `npm test` con PostgreSQL temporal `busesuta_test`: 70 suites/1235 unitarias y
  28 suites/355 integraciones aprobadas; salida 0. Incluye pruebas nuevas de
  sesión, CSRF, roles, tenant, hash, login y duplicados concurrentes.
- Arranque real de `server.js`: health 200 y alta sin sesión 401. La suite de
  integración monta Auth y PostgreSQL reales; no se crea una cuenta operativa.
- Primera ejecución sin `DATABASE_URL` falló por el guard de pruebas; después se
  inició la base temporal y se repitió la suite completa con éxito. No se leyó `.env`.
- El commit `1fff04b` se publicó en `feature/AUTH-06-crear-oficinista` y abrió
  [PR #53](https://github.com/Pato77232/ProyectoBusesUTA/pull/53) contra `develop`.
  GitHub muestra a Shirley (`shirley6126`) como revisora solicitada. Revisión
  humana, combinación con la base vigente e integración pendientes.

## Revisión, integración y cierre — 2 de noviembre de 2026

Shirley aprobó la cabeza `c28e431` de la
[PR #53](https://github.com/Pato77232/ProyectoBusesUTA/pull/53) después de una
verificación independiente de permisos, CSRF, aislamiento por cooperativa,
duplicados concurrentes y login posterior del CLERK. La PR se integró en
`develop` mediante `f5b9bde` a las 23:32 (America/Guayaquil).

La regresión completa más reciente de la base integrada, registrada al integrar
la PR #65 el 3 de noviembre, aprobó 1772 pruebas unitarias y 564 de integración.
Esta referencia posterior no sustituye la revisión específica anterior; acredita
que el recorrido permanece en la base comprobada `65957a9`. No se crea una cuenta
operativa ni se amplía el alcance a pantalla, recuperación o administración de
oficinistas. AUTH-06 queda Cerrada; los apartados anteriores conservan el estado
histórico de sus respectivas sesiones.
