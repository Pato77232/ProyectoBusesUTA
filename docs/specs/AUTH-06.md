# AUTH-06: Crear oficinista de cooperativa

- **ID local:** AUTH-06; sin ticket externo.
- **Responsable:** Pablo. **Revisora propuesta:** Shirley; revisión de esta spec pendiente.
- **Estado:** Borrador técnico; autoridad funcional confirmada, sin implementación.
- **Base:** origin/develop 8fdf7e4, consultada el 2 de noviembre de 2026.
- **Rama documental:** feature/ACUERDOS-01-contratos-pagos.
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

## Contrato técnico propuesto para revisión

POST /api/v1/auth/clerks, sesión válida COOPERATIVE_ADMIN y CSRF.
Reutilizar credentials.js: objeto estricto, email normalizado de hasta 254,
password de 15–128 puntos de código sin trim. Rechazar role/cooperative_id y
cualquier campo extra. No aceptar cooperativa por ruta o cabecera elegida.
201 {user:{id,email,role,cooperative_id}}, Cache-Control: no-store, sin contraseña,
hash, cookie de sesión nueva ni datos privados. Validar coherencia con publicUser.
400 VALIDATION_ERROR; 401 por sesión inválida; 403 por rol/CSRF, según errores
existentes de Auth; 409 REGISTRATION_CONFLICT genérico para email duplicado.
Cooperativa inconsistente o eliminada concurrentemente: rechazar sin insertar;
precisar traducción al error existente de Auth durante revisión, sin filtrar SQL.

## Diseño y datos

Caso de uso independiente en application con repository/hasher inyectados;
normalización/identidad en domain, Argon2id según ADR. Puerto pequeño para crear
CLERK, implementación PostgreSQL con consultas parametrizadas. HTTP solo valida,
autoriza y traduce. No importar internos de tenants/payments; composición por
index.js y server.js. Reutilizar users, FK e índice único de email si sus
restricciones admiten el rol; verificarlo antes de programar. Si hiciera falta
esquema, crear migración nueva, nunca editar las publicadas.

## Criterios y pruebas previstas

- [ ] Alta correcta persiste hash, CLERK y cooperativa de sesión; login posterior
      devuelve esa identidad, sin iniciar sesión automáticamente al crearla.
- [ ] Rechazar CUSTOMER, CLERK, SYSTEM_ADMIN y sesión ausente/vencida/revocada.
- [ ] Rechazar CSRF inválido, campos extra y credenciales inválidas sin escritura.
- [ ] Email duplicado normalizado y dos altas simultáneas crean como máximo una cuenta.
- [ ] No crear/modificar cuentas en otra cooperativa, aunque se manipule el body.
- [ ] QA aislado: identidades ficticias; contraseña no se guarda ni comparte en
      Git, specs, logs, capturas o chats. Guardar solo hash en BD de prueba.
- [ ] Sin secretos en respuestas, registros o errores.

Unitarias del caso de uso y contratos; integración HTTP/PostgreSQL real con
sesión y CSRF; regresión Auth existente. Ejecutar lint, format:check y npm test
según testing-database.md; verificar arranque real si cambia composición.

## Plan pequeño y pendientes

1. Shirley revisa ruta, respuesta, errores y contrato consumido por Pagos.
2. Implementar caso de uso/puerto y pruebas en rama propia AUTH-06.
3. Adaptador/HTTP y composición, pruebas reales; después revisión humana.
No implementar mientras el contrato anterior siga en borrador. No introducir
límites de cantidad de CLERK ni reglas de contraseña nuevas por inferencia.
SOLID: responsabilidad única e inyección proporcional; sin interfaz en este alcance.
Usabilidad: errores consistentes permitirán explicar el resultado sin revelar
cuentas ajenas; no se acredita pantalla ni accesibilidad visual.
Defecto inducido: ninguno autorizado. Evidencia actual solo documental; sin
pruebas de producto ni implementación/integración de AUTH-06. Esta publicación
es documental, no disponibilidad del endpoint. Asistencia de Codex.
