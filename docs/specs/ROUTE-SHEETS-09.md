# ROUTE-SHEETS-09: Registro efectivo de la auditoría de modificaciones

- **ID local:** ROUTE-SHEETS-09, sin ticket externo. Gestor externo pendiente para después de la primera revisión.
- **Módulo:** `route-sheets` (backend). No modifica otros módulos.
- **Responsable:** David, por solicitud directa del 4 de noviembre de 2026.
- **Revisor propuesto / confirmado:** Leslie / sin confirmación registrada.
- **Estado:** Sección 1 guardada por David en `268160f`. Sección 2 añade verificación con Node 24 y arranque real; evidencia en §15. Revisión humana, commit de sección 2 y publicación pendientes; no se afirma integración.
- **Prioridad y dependencias:** interna al módulo. Conserva el contrato de [ROUTE-SHEETS-01](ROUTE-SHEETS-01.md) y convive con la programación persistida de [ROUTE-SHEETS-06](ROUTE-SHEETS-06.md). El registro de logs no depende de Fleet, Frecuencias ni Bookings; la comprobación de pasajeros sigue dependiendo de `bookingQueries`, que hoy no se inyecta en `server.js`.
- **Rama / base comprobada:** `feature/ROUTE-SHEETS-09-auditoria-modificaciones`, creada por David el 4 de noviembre de 2026 sobre `7f378fc` (`develop`); la sección 0 se registró en `73f1b58`.
- **Autorización de alcance:** David pidió revisar los módulos pendientes, autorizó redactar la sección 0 y, el 4 de noviembre de 2026, confirmó las recomendaciones Q1–Q4 y autorizó la sección 1 en esa rama. Siguen sin autorizar commits, push, merge, tag ni integración.
- **Sección 2 autorizada el 4 de noviembre:** David eligió «Cerrar la verificación con Node 24 y arranque real, conservando el 503 cuando falta el proveedor». Base limpia `268160f`, sección 1 ya guardada por David. Esta sección añade pruebas de la composición productiva y evidencia; no implementa APIs de Bookings ni cambia decisiones Q1–Q4.
- **Fuentes:** [reglas](../business-rules.md), [arquitectura](../architecture.md), [convenciones](../conventions.md), [calidad](../calidad.md), [defectos académicos](../errores-inducidos.md), [equipo](../equipo-y-acuerdos.md), [flujo](../flujo-codex.md) y [estado](../estado-proyecto.md).

## 1. Objetivo

Hacer que la auditoría de modificaciones de hojas de ruta funcione de extremo a extremo: que cada cambio registrable deje un log persistido y que `GET /api/v1/route-sheets/:id/modification-logs` devuelva registros reales de la cooperativa autenticada.

Diagnóstico previo a la sección 1 (conservado como antecedente):

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

- Registrar el cambio desde los cuatro casos de uso legacy (`AddAssignmentToRouteSheet`, `RemoveAssignmentFromRouteSheet`, `AddRestDayToRouteSheet`, `RemoveRestDayFromRouteSheet`), apoyados en un servicio de aplicación pequeño que construye el log y lo guarda con el repositorio existente.
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

Nota de contrato: los `DELETE` ya leen el cuerpo para el motivo. Es inusual en REST, pero se conserva para no romper clientes; no se cambia por query string en esta tarea. `DELETE /rest-days` acepta `reasonForChange` (nombre documentado en ROUTE-SHEETS-01) y, como alias, `reason`; `DELETE /assignments` usa `reason`.

## 7. Criterios de aceptación

- [x] Dada una asignación creada con `reason`, cuando la operación termina, entonces existe exactamente un log con actor, cooperativa, entidad y motivo correctos.
- [x] Dada una asignación o día de parada eliminado con `reason`, cuando la operación termina, entonces existe el log correspondiente con `action = DELETE`.
- [x] Dada una operación sin `reason`, cuando termina, entonces el cambio se aplica igual que hoy y no se escribe log.
- [x] Dado un administrador de otra cooperativa, cuando consulta los logs, entonces no ve registros ajenos y la hoja ajena responde 404.
- [x] Dado un fallo del proveedor de pasajeros, cuando la operación lo requiere, entonces se conserva el 503 actual y no se escribe un log de un cambio no aplicado.
- [x] Las pruebas y expectativas existentes se conservan sin modificar.
- [x] Lint, formato y pruebas se ejecutan desde `backend/` y sus resultados reales se registran en §13.

Verificación: unitarias y HTTP aprobadas en §13. La baja de asignaciones y de días de parada solo alcanza a escribir el log cuando hay proveedor de pasajeros; hoy `server.js` no inyecta `bookingQueries` y esos `DELETE` siguen respondiendo 503 antes de escribir (ver §8).

## 8. Casos borde y errores

- `reason` vacío o solo espacios: se trata como ausente; no se inventa un motivo ni se escribe un log.
- Fallo al insertar el log después de aplicar el cambio: el cambio queda sin auditoría; ver Q2.
- **Límite vigente de composición:** `server.js` no inyecta `bookingQueries`. Por eso los dos `DELETE` (asignación y día de parada) responden 503 antes de aplicar el cambio y no escriben log; las altas sí registran auditoría. Verificado en §13 con una prueba que sustituye el proveedor. Conectar ese puerto corresponde a la tarea de integración con Bookings, no a esta spec.
- Hoja `PUBLISHED`: sigue respondiendo `ROUTE_SHEET_NOT_EDITABLE`; no se escribe log.
- Hoja con programación persistida: sigue respondiendo `409 ROUTE_PROGRAMMING_LEGACY_OPERATION` antes de llegar al caso de uso.
- Asignación o día de parada inexistente: no se escribe log de una entidad que no existe.
- Valores anterior/nuevo: nunca incluyen datos personales de pasajeros.

## 9. Pruebas esperadas

- **Unitarias:** el caso de uso escribe un log por cambio con los campos correctos; sin `reason` no escribe; `modifiedBy` y `cooperativeId` provienen del contexto y no del cuerpo; error del repositorio se propaga sin convertirse en éxito.
- **Integración HTTP con PostgreSQL aislado:** POST y DELETE con `reason` seguidos de `GET /:id/modification-logs`; aislamiento entre cooperativas; hoja publicada y hoja programada conservan sus errores actuales.
- **No se modifica ninguna prueba existente** para hacerla pasar.

## 10. Decisiones y preguntas

Decisiones confirmadas por David el 4 de noviembre de 2026 al autorizar la sección 1 (respuesta humana registrada por el solicitante; no acredita aprobación de otros integrantes):

- **Q1 — `reason` obligatorio:** no. Se registra auditoría solo cuando el motivo llega informado y no vacío; el cambio se aplica igual que antes cuando falta.
- **Q2 — Atomicidad:** se acepta el límite. El cambio y el log no comparten transacción; un fallo del repositorio de logs se propaga y el cambio ya aplicado queda sin auditoría. Hay una prueba unitaria que fija ese comportamiento.
- **Q3 — Contenido de `old_value`/`new_value`:** instantánea mínima (`busId` y `frequencyId` en asignación; `busId` en día de parada), sin datos personales.
- **Q4 — Auditar `PUT /:id/programming`:** no en esta spec. Requiere agregar `reason` al contrato en una tarea separada.

Sigue abierta:

- **Q5 — ¿Quién revisa?** Leslie está propuesta; no hay aceptación registrada. Para acuerdos, seguir `docs/equipo-y-acuerdos.md` y registrar solo respuestas humanas reales.

## 11. Defecto inducido

No aplica. Esta spec no introduce ni corrige defectos académicos y no debilita pruebas.

## 12. Diseño SOLID y usabilidad

- El puerto `RouteSheetModificationLogRepository` ya existe en `domain` y su implementación PostgreSQL en `infrastructure`; se conserva la inversión de dependencias.
- El registro pertenece a `application`; el controlador sigue sin lógica de negocio.
- No hay interfaz de usuario en este alcance, por lo que no se declara usabilidad verificada. La pantalla que consuma estos logs se especificará aparte.
- Se reutilizan la entidad `RouteSheetModificationLog` y su repositorio. La construcción del log se extrae a `application/services/record-route-sheet-modification.js` porque los cuatro casos de uso la necesitan y duplicarla habría dispersado el mismo formato; no se crea un puerto nuevo ni se mueve lógica de dominio.
- `modify-route-sheet-with-audit.use-case.js` sigue sin cablear: valida y registra en lote, pero no aplica cambios ni es necesario para estos cuatro caminos. Se deja intacto para una tarea de auditoría masiva posterior; no se elimina en esta sección.

## 13. Plan y evidencias

Plan ejecutado, un paso pequeño por vez:

1. Confirmar Q1–Q4 y la revisora (sección 0 cerrada).
2. Registrar el cambio en los cuatro casos de uso legacy, con pruebas unitarias.
3. Probar el recorrido HTTP con PostgreSQL aislado y el aislamiento por cooperativa.
4. Registrar evidencia real y actualizar la fila de `docs/estado-proyecto.md`.

### Sección 0 (4 de noviembre de 2026)

Solo documentación. Se inspeccionaron `composition.js`, los cuatro casos de uso, `modify-route-sheet-with-audit.use-case.js`, el repositorio, la entidad, la migración `1792480000000-create-route-sheets.js`, el controlador y las rutas. No se ejecutaron lint, formato, pruebas ni arranque porque no cambió código ni configuración ejecutable; no se acredita ningún resultado funcional nuevo.

### Sección 1 (4 de noviembre de 2026)

Cambios realizados:

- `application/services/record-route-sheet-modification.js` (nuevo): construye el log y lo guarda solo cuando llega un motivo no vacío y el repositorio está inyectado.
- Los cuatro casos de uso legacy reciben `routeSheetModificationLogRepository` y registran un log `CREATE`/`DELETE` con la instantánea mínima de Q3. La baja usa el `hasPassengersWarning` que ya calculaba la validación de pasajeros.
- `composition.js` inyecta el repositorio PostgreSQL existente en los cuatro casos de uso.
- El controlador de `DELETE /rest-days` acepta `reason` como alias de `reasonForChange`, para que el motivo documentado en §4 no se pierda.
- Pruebas nuevas: `tests/unit/route-sheets/application/modification-audit.test.js` (7 casos) y `tests/integration/route-sheets/route-sheet-modification-logs.http.test.js` (10 casos HTTP, incluidos hoja con programación persistida, hoja publicada, cuerpo que intenta falsear cooperativa/actor y alias de motivo).
- No se modificó ninguna prueba existente, no se agregaron dependencias y no hay migración nueva.

Resultados reales, ejecutados desde `backend/` (Node 22.19.0 local; `engines` declara Node 24):

- `npx jest tests/unit/route-sheets`: 23 suites y 488 pruebas aprobadas.
- `DATABASE_URL=…busesuta_test NODE_ENV=test npx jest tests/integration/route-sheets --runInBand`: 9 suites y 133 pruebas aprobadas, incluidas las 10 nuevas; PostgreSQL aislado de `docker-compose.test.yml`.
- `npm test` completo: fase unitaria con 96 suites y 1826 pruebas aprobadas; fase de integración con 46 de 47 suites y 590 de 591 pruebas aprobadas.
- Único fallo de la corrida completa: `tests/integration/fleet/bus-photo-storage.test.js` agota el tiempo de espera de 20 s al escribir 5 MiB en un directorio temporal. Se reprodujo aislado y solo importa almacenamiento de Fleet; no toca `route-sheets` ni este cambio.
- `npm run lint`: sin errores ni advertencias.
- `npm run format:check`: falla por 37 archivos previos ajenos a este cambio. Los siete archivos tocados pasan `prettier --check` por separado.

Límites comprobados:

- Las pruebas HTTP levantan `createApp` con `createRouteSheetsModule` y proveedores sustitutos; no arrancan `server.js`.
- Contra `server.js`, las altas ya escriben auditoría, pero las bajas siguen respondiendo 503 por la ausencia de `bookingQueries` (§8). No se corrigió esa composición aquí.
- No se ejecutó arranque real con Docker del backend ni verificación manual en navegador: esta sección no tiene interfaz.

## 14. Revisión y cierre

- Revisora propuesta: Leslie, sin respuesta registrada.
- Sección 0 en `73f1b58` y sección 1 en `268160f`, guardadas por David. La sección 2 se registra en §15; no se acredita publicación, aprobación ni integración.
- Próxima acción: revisión humana de las secciones 1 y 2 y publicación por el responsable. No se presenta habilitada la auditoría de bajas en producción: conectar `bookingQueries` requiere una tarea coordinada con Bookings, fuera de este incremento. Q1–Q4 siguen vigentes, incluido el límite de no atomicidad.

## 15. Sección 2 — cierre de verificación con composición real

Alcance confirmado por David: ejecutar las comprobaciones con Node 24 y PostgreSQL aislado y añadir una regresión que invoque `server.start` y use HTTP real, autenticación, Fleet y Frecuencias públicos sin sustituir sus proveedores. Preparar únicamente usuarios, buses y frecuencias ficticios en la base aislada; la hoja y sus cambios se crean por HTTP. Usar el cierre real `stop` del servidor y su worker.

Casos: salud del servidor, altas de asignación/parada con y sin motivo, lectura del log real, actor/tenant del contexto, aislamiento, CSRF y los dos DELETE sin bookingQueries. Las bajas deben responder 503/BOOKING_QUERIES_UNAVAILABLE y conservar filas/logs idénticos, incluso con advertencia forzada y reintento. No se interpreta proveedor ausente como `false` ni se inyecta un doble para habilitar producción.

No hay cambios a código productivo, migraciones, dependencias, pruebas anteriores ni frontend. La no atomicidad aceptada en Q2 permanece y no se acredita resuelta por estas pruebas. El contrato público de pasajeros sigue como dependencia de una tarea coordinada con Leslie; `bookings/index.js` no expone actualmente esas dos consultas.

Verificación final con **Node 24.21.0/Linux y PostgreSQL 16.13 aislado**:

- Prueba nueva `tests/integration/route-sheets/modification-audit-server.test.js`: **8/8 aprobadas**, primero de forma dirigida y después dentro de la regresión completa. Inicia el servidor real sin mocks de módulos/proveedores y termina con `running.stop()`, cerrando HTTP, worker y pool.
- `npm run lint`: aprobado, también comprobado localmente antes de la corrida con Node 24.
- `npm run format:check`: falla por los mismos **37 archivos previos**, sin cambios de esta sección. El JS nuevo pasa Prettier por separado.
- `npm test`: **1826/1826 unitarias (96 suites)** y **602/602 integraciones (48 suites)** aprobadas. También aprobaron fotos de Fleet y administradores en esta ejecución, sin modificar sus pruebas ni sus tiempos; no se presenta esto como una corrección permanente de sus fallos históricos.

El primer intento de levantar docker-compose.test.yml no pudo ocupar el puerto 55433, ya usado por otro entorno. No se detuvo ni reutilizó ese entorno. Se creó una base exclusiva en una red propia sin publicar puertos; solo contenedores QA accedieron a ella. Al terminar se retiraron el contenedor/base, el contenedor detenido del intento inicial y la red propios. No se leyó .env. Npm ci solo se ejecutó en el contenedor efímero, sin cambiar dependencias; se verificó lock idéntico antes de reutilizar los binarios nativos de Sharp de la imagen local.

El diff final contiene únicamente esta spec, la fila de estado y una prueba nueva. Se revisaron los archivos completos, `git diff --check`, el formato del JS nuevo y las referencias locales; sin conflictos ni espacios finales. No cambió código de producción, otra prueba, migración ni dependencia. Las evidencias de sección 1 conservan su alcance histórico. Asistencia de Codex en planificación, pruebas y documentación; revisión humana, commit de esta sección, publicación e integración pendientes.

Commit sugerido: `test(hojas-ruta): verifica la auditoría con el servidor real`, con pie `Refs: docs/specs/ROUTE-SHEETS-09.md`.
