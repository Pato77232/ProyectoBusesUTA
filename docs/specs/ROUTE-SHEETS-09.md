# ROUTE-SHEETS-09: Registro efectivo de la auditoría de modificaciones

- **ID local:** ROUTE-SHEETS-09, sin ticket externo. Gestor externo pendiente para después de la primera revisión.
- **Módulo:** `route-sheets` (backend). No modifica otros módulos.
- **Responsable:** David, por solicitud directa del 4 de noviembre de 2026.
- **Revisor propuesto / confirmado:** Leslie / sin confirmación registrada.
- **Estado:** **Borrador.** Solo sección 0 documental; sin implementación, pruebas de producto ni commit.
- **Prioridad y dependencias:** interna al módulo. Conserva el contrato de [ROUTE-SHEETS-01](ROUTE-SHEETS-01.md) y convive con la programación persistida de [ROUTE-SHEETS-06](ROUTE-SHEETS-06.md). El registro de logs no depende de Fleet, Frecuencias ni Bookings; la comprobación de pasajeros sigue dependiendo de `bookingQueries`, que hoy no existe en la API pública de Bookings.
- **Rama / base comprobada:** `feature/ROUTE-SHEETS-09-auditoria-modificaciones`, creada por David el 4 de noviembre de 2026 sobre `7f378fc` (`develop`), árbol limpio.
- **Autorización de alcance:** David pidió revisar los módulos pendientes y autorizó redactar la sección 0 en esa rama. No autoriza la sección 1, commits, push ni integración.
- **Fuentes:** [reglas](../business-rules.md), [arquitectura](../architecture.md), [convenciones](../conventions.md), [calidad](../calidad.md), [defectos académicos](../errores-inducidos.md), [equipo](../equipo-y-acuerdos.md), [flujo](../flujo-codex.md) y [estado](../estado-proyecto.md).

## 1. Objetivo

Hacer que la auditoría de modificaciones de hojas de ruta funcione de extremo a extremo: que cada cambio registrable deje un log persistido y que `GET /api/v1/route-sheets/:id/modification-logs` devuelva registros reales de la cooperativa autenticada.

Hoy la infraestructura existe pero no se usa:

- La tabla `route_sheet_modification_logs` y `PgRouteSheetModificationLogRepository` (guardar, listar por hoja y filtrar) están implementadas.
- El caso de uso `modify-route-sheet-with-audit.use-case.js` existe, pero **no está importado en `composition.js`**: es código sin cablear.
- Los casos de uso de alta/baja de asignaciones y de días de parada reciben `reason`/`reasonForChange` desde el controlador, pero **solo los usan para validar el conflicto de pasajeros**; nunca escriben un log.
- No hay ninguna prueba que mencione los logs de modificación.

Consecuencia verificable: ninguna operación de producción escribe en esa tabla, así que el endpoint de consulta no tiene registros que devolver.

## 2. Reglas de negocio involucradas

Esta spec no agrega reglas nuevas. Conserva:

- **RN-30:** la hoja de ruta es la asignación operativa diaria; sus cambios deben poder rastrearse.
- **RN-32:** los días de parada forman parte de esa asignación y también son modificables.
- **ROUTE-SHEETS-01 §2 y §4:** `RouteSheetModificationLog` es obligatorio para cambios en hojas existentes y debe conservar `modifiedBy`, `reason`, entidad afectada, valores anterior/nuevo y la advertencia de pasajeros.
- **RN-53** no aplica: su justificación obligatoria es de comprobantes de pago, no de hojas de ruta. No se traslada por analogía.

## 3. Alcance

**Incluye:**

- Cablear en `composition.js` el caso de uso `ModifyRouteSheetWithAudit` o, si se prefiere, invocar el repositorio de logs desde los cuatro casos de uso legacy (`AddAssignmentToRouteSheet`, `RemoveAssignmentFromRouteSheet`, `AddRestDayToRouteSheet`, `RemoveRestDayFromRouteSheet`).
- Escribir exactamente un log por cambio registrable, con actor y cooperativa tomados de la sesión verificada.
- Devolver esos logs en el endpoint de consulta ya existente.
- Pruebas unitarias del registro y pruebas HTTP de integración con PostgreSQL aislado, incluido el aislamiento por cooperativa.
- Evidencia real de lint, formato y pruebas, y actualización de la fila en `docs/estado-proyecto.md`.

**No incluye:**

- Volver `reason` obligatorio en todas las modificaciones (decisión Q1).
- Auditar el `PUT /:id/programming` (decisión Q4).
- Permitir editar hojas `PUBLISHED`: siguen bloqueadas por `assertEditable()` y por el guard de programación.
- Migraciones nuevas: la tabla ya existe.
- Cambios en Fleet, Frecuencias, Bookings, frontend o reglas de negocio.
- Introducir o corregir defectos académicos.

## 4. Flujo principal

1. Un `COOPERATIVE_ADMIN` autenticado llama a `POST /:id/assignments`, `DELETE /:id/assignments/:assignmentId`, `POST /:id/rest-days` o `DELETE /:id/rest-days/:restDayId` con `reason` en el cuerpo.
2. El controlador deriva `cooperativeId` y `modifiedBy` de `req.auth.user`; nunca del cuerpo.
3. El caso de uso valida hoja, pertenencia, frecuencia/bus y conflictos como hoy.
4. Se aplica el cambio y se escribe un log con: hoja, cooperativa, grupo, actor, motivo, acción, entidad afectada, identificador de la entidad y valores anterior/nuevo.
5. `GET /:id/modification-logs` devuelve los logs de esa hoja y cooperativa, más recientes primero.

## 5. Datos

No hay migración nueva. Se reutiliza `route_sheet_modification_logs` con estas correspondencias:

| Columna | Valor propuesto |
|---|---|
| `route_sheet_id` | Hoja modificada |
| `cooperative_id` | Cooperativa de la sesión verificada |
| `bus_group_id` | Grupo de la hoja |
| `modified_by` | `req.auth.user.id` |
| `reason` | Motivo recibido, recortado |
| `action` | `CREATE` o `DELETE` según la operación |
| `affected_entity` | `ASSIGNMENT` o `REST_DAY` |
| `entity_id` | Identificador de la asignación o del día de parada |
| `old_value` / `new_value` | Instantánea mínima de la entidad (ver Q3) |
| `has_passengers_warning` | `true` solo si se forzó con pasajeros |

La tabla ya limita `affected_entity` a 20 caracteres y exige `entity_id` UUID no nulo.

## 6. Endpoints

No se proponen rutas nuevas. Se documenta el contrato ya existente:

| Método | Ruta | Rol | Respuestas |
|---|---|---|---|
| POST | `/api/v1/route-sheets/:id/assignments` | `COOPERATIVE_ADMIN` + CSRF | 200, 400, 403, 404, 409 |
| DELETE | `/api/v1/route-sheets/:id/assignments/:assignmentId` | `COOPERATIVE_ADMIN` + CSRF | 200, 400, 403, 404, 409 |
| POST | `/api/v1/route-sheets/:id/rest-days` | `COOPERATIVE_ADMIN` + CSRF | 200, 400, 403, 404, 409 |
| DELETE | `/api/v1/route-sheets/:id/rest-days/:restDayId` | `COOPERATIVE_ADMIN` + CSRF | 200, 400, 403, 404, 409 |
| GET | `/api/v1/route-sheets/:id/modification-logs` | `COOPERATIVE_ADMIN` | 200, 403, 404 |

Nota de contrato: los `DELETE` ya leen el cuerpo para el motivo. Es inusual en REST, pero se conserva para no romper clientes; no se cambia por query string en esta tarea.

## 7. Criterios de aceptación

- [ ] Dada una asignación creada con `reason`, cuando la operación termina, entonces existe exactamente un log con actor, cooperativa, entidad y motivo correctos.
- [ ] Dada una asignación o día de parada eliminado con `reason`, cuando la operación termina, entonces existe el log correspondiente con `action = DELETE`.
- [ ] Dada una operación sin `reason`, cuando termina, entonces el cambio se aplica igual que hoy y no se escribe log.
- [ ] Dado un administrador de otra cooperativa, cuando consulta los logs, entonces no ve registros ajenos y la hoja ajena responde 404.
- [ ] Dado un fallo del proveedor de pasajeros, cuando la operación lo requiere, entonces se conserva el 503 actual y no se escribe un log de un cambio no aplicado.
- [ ] Las pruebas y expectativas existentes se conservan sin modificar.
- [ ] Lint, formato y pruebas se ejecutan desde `backend/` y sus resultados reales se registran en §13.

## 8. Casos borde y errores

- `reason` vacío o solo espacios: se trata como ausente; no se inventa un motivo ni se escribe un log.
- Fallo al insertar el log después de aplicar el cambio: el cambio queda sin auditoría; ver Q2.
- Hoja `PUBLISHED`: sigue respondiendo `ROUTE_SHEET_NOT_EDITABLE`; no se escribe log.
- Hoja con programación persistida: sigue respondiendo `409 ROUTE_PROGRAMMING_LEGACY_OPERATION` antes de llegar al caso de uso.
- Asignación o día de parada inexistente: no se escribe log de una entidad que no existe.
- Valores anterior/nuevo: nunca incluyen datos personales de pasajeros.

## 9. Pruebas esperadas

- **Unitarias:** el caso de uso escribe un log por cambio con los campos correctos; sin `reason` no escribe; `modifiedBy` y `cooperativeId` provienen del contexto y no del cuerpo; error del repositorio se propaga sin convertirse en éxito.
- **Integración HTTP con PostgreSQL aislado:** POST y DELETE con `reason` seguidos de `GET /:id/modification-logs`; aislamiento entre cooperativas; hoja publicada y hoja programada conservan sus errores actuales.
- **No se modifica ninguna prueba existente** para hacerla pasar.

## 10. Preguntas abiertas

- **Q1 — ¿`reason` obligatorio?** Recomendación: no en esta sección; registrar cuando venga informado. Hacerlo obligatorio cambia el contrato y afecta clientes/pruebas actuales que no lo envían, y requeriría autorización expresa.
- **Q2 — ¿Atomicidad?** El camino legacy no abre transacción: el cambio y el log podrían separarse ante un fallo. Recomendación: aceptar el límite, documentarlo y probarlo en esta sección; mover cambio y log a una transacción sería una tarea posterior.
- **Q3 — ¿Qué guardar en `old_value`/`new_value`?** Recomendación: instantánea mínima (`busId`, `frequencyId` en asignación; `busId` en día de parada), sin datos personales.
- **Q4 — ¿Auditar el `PUT /:id/programming`?** Hoy solo acepta `expectedRevision` y `programming`; no hay motivo ni entidad con UUID que registrar. Recomendación: spec separada que agregue `reason` al contrato.
- **Q5 — ¿Quién revisa?** Leslie está propuesta; no hay aceptación registrada. Para acuerdos, seguir `docs/equipo-y-acuerdos.md` y registrar solo respuestas humanas reales.

## 11. Defecto inducido

No aplica. Esta spec no introduce ni corrige defectos académicos y no debilita pruebas.

## 12. Diseño SOLID y usabilidad

- El puerto `RouteSheetModificationLogRepository` ya existe en `domain` y su implementación PostgreSQL en `infrastructure`; se conserva la inversión de dependencias.
- El registro pertenece a `application`; el controlador sigue sin lógica de negocio.
- No hay interfaz de usuario en este alcance, por lo que no se declara usabilidad verificada. La pantalla que consuma estos logs se especificará aparte.
- No se crean abstracciones nuevas: se reutiliza el caso de uso y el repositorio existentes.

## 13. Plan y evidencias

Plan propuesto, un paso pequeño por vez:

1. Confirmar Q1–Q4 y la revisora (sección 0 cerrada).
2. Cablear el registro en los cuatro casos de uso legacy, con pruebas unitarias.
3. Probar el recorrido HTTP con PostgreSQL aislado y el aislamiento por cooperativa.
4. Registrar evidencia real y actualizar la fila de `docs/estado-proyecto.md`.

Evidencia de esta sección 0 (4 de noviembre de 2026): solo documentación. Se inspeccionaron `composition.js`, los cuatro casos de uso, `modify-route-sheet-with-audit.use-case.js`, el repositorio, la entidad, la migración `1792480000000-create-route-sheets.js`, el controlador y las rutas. No se ejecutaron lint, formato, pruebas ni arranque porque no cambió código ni configuración ejecutable; no se acredita ningún resultado funcional nuevo.

## 14. Revisión y cierre

- Revisora propuesta: Leslie, sin respuesta registrada.
- Sin commit, push, PR ni integración. La rama se creó sobre `7f378fc`.
- Próxima acción: confirmar Q1–Q4 y autorizar la sección 1.
