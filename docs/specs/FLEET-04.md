# FLEET-04: Consultar buses registrados desde Route Sheets

- **ID local:** FLEET-04; libre en las specs y ramas accesibles al comprobarlo el 31 de octubre de 2026.
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** `fleet`; ajuste acotado en `route-sheets`
- **Responsable:** Edwin, responsable de Fleet y solicitante de completar esta tarea
- **Revisor propuesto / confirmado:** David propuesto para revisión de código, pendiente. Edwin comunicó su confirmación del contrato y los cambios de T2; no equivale a revisión de código aprobada
- **Estado:** Implementación T1/T2 verificada y preparada para PR por petición de Edwin; revisión humana e integración pendientes
- **Prioridad y dependencias:** FLEET-01, FLEET-02 (PR #27) y ROUTE-SHEETS-01 (PR #13), presentes en develop. Prioritaria para que hojas de ruta opere con buses reales.
- **Rama / PR / base comprobada:** `feature/FLEET-04-consulta-buses`, creada desde `origin/develop` en `4f34748` el 31 de octubre de 2026; actualizada por avance directo a `b1e6720` el 1 de noviembre; sin PR.
- **Autorización de alcance:** el 31 de octubre de 2026 se aprobó por chat iniciar solo T1 (Fleet). Edwin pidió terminar FLEET-04 y comunicó expresamente que David confirmó BusSummary, los cambios de asignaciones/paradas y BUS_NOT_IN_ROUTE_SHEET_GROUP (409); T2 queda autorizado con ese alcance.

## 1. Objetivo

Route Sheets ya define un puerto `BusQueryPort` y un adaptador, pero Fleet no publica ninguna lectura de buses: su API pública solo ofrece grupos y plantillas. Esta tarea publica una API interna de solo lectura y hace que hojas de ruta valide contra buses reales de la cooperativa y del grupo de la hoja.

## 2. Reglas de negocio involucradas

- **RN-30:** la hoja de ruta vincula un grupo de buses; un bus ajeno a ese grupo no participa en ella.
- **RN-32:** un día de parada corresponde a un bus de la misma hoja, por lo que también se valida su grupo.
- **Aislamiento multi-tenant (`AGENTS.md`):** toda consulta filtra por el `cooperative_id` de la identidad autenticada. Un bus de otra cooperativa se comporta como inexistente.

## 3. Alcance

**Incluye:**

- Métodos de lectura en el puerto `BusRepository` y en `PgBusRepository`.
- `busQueries` en el resultado de `createFleetModule`.
- En `route-sheets`: recibir `busQueries` en su composición, leer `busGroupId` y rechazar buses de otro grupo al asignar y al registrar un día de parada.
- Pruebas de aislamiento entre cooperativas y de pertenencia al grupo.

**No incluye:**

- Migraciones: `1793440000000-register-buses.js` ya crea `buses` con `cooperative_id` y `bus_group_id`.
- Endpoints HTTP ni pantallas de consulta de buses.
- Asientos, fotografías, VIN o inventario por viaje.
- Instanciar `route-sheets` en `server.js`: requiere resolver contratos ajenos a Fleet (sección 8) y FREQ-02 lo reserva para ROUTE-SHEETS-02.
- Cambios en `frequencies`, `bookings` o en otros casos de uso de `route-sheets`.

## 4. Flujo principal

1. El caso de uso de `route-sheets` llama a `busQueryPort.findById(busId, cooperativeId)` con la cooperativa autenticada.
2. El adaptador delega en `fleet.busQueries`, recibido por composición.
3. Fleet devuelve el resumen del bus o `null`.
4. Si es `null`, se conserva `BusNotFromCooperativeError`.
5. Si `bus.busGroupId` difiere del grupo de la hoja, se rechaza la operación.

## 5. Datos

Sin tablas nuevas. Contrato público, igual a los métodos de `BusQueryPort`:

| Método | Resultado |
|---|---|
| `busQueries.findById(id, cooperativeId)` | `BusSummary` o `null` |
| `busQueries.findByBusGroupId(busGroupId, cooperativeId)` | `BusSummary[]`, ordenado por `unitNumber` |
| `busQueries.findByCooperativeId(cooperativeId)` | `BusSummary[]`, ordenado por `unitNumber` |

`BusSummary`: `{ id, cooperativeId, busGroupId, plate, unitNumber, capacity }`. `plate` usa el formato de presentación `TBM-2213` y `unitNumber` es un número. Se usa camelCase como en la respuesta de alta y se omiten VIN, fotos y plantilla porque hojas de ruta no los necesita.

Un `id` o `busGroupId` que no sea UUID devuelve `null` o `[]`, sin llegar a PostgreSQL: el cuerpo de hojas de ruta solo exige presencia y, de otro modo, el error de tipo produciría un 500.

## 6. Endpoints

No se crean endpoints. Los existentes de hojas de ruta cambian solo en el rechazo por grupo:

| Método | Ruta | Roles | Cambio |
|---|---|---|---|
| POST | `/api/v1/route-sheets/:id/assignments` | COOPERATIVE_ADMIN | Bus de otro grupo: error definido en la sección 10 |
| POST | `/api/v1/route-sheets/:id/rest-days` | COOPERATIVE_ADMIN | Bus de otro grupo: error definido en la sección 10 |

## 7. Criterios de aceptación

- [x] Dado un bus de la cooperativa A, cuando la cooperativa B lo consulta por `findById`, entonces recibe `null`.
- [x] Dados buses de A y B, cuando se lista por cooperativa o por grupo, entonces solo aparecen los de la cooperativa indicada, también si B usa un `busGroupId` de A.
- [x] Dado un bus del grupo X, cuando se asigna a una hoja del grupo Y de la misma cooperativa, entonces se rechaza y no se guarda nada.
- [x] Dado un bus del grupo X, cuando se registra como día de parada en una hoja del grupo Y, entonces se rechaza y no se guarda nada.
- [x] Dado un bus de otra cooperativa, cuando se asigna o se registra su parada, entonces responde `BUS_NOT_FROM_COOPERATIVE`.
- [x] Dado un bus del grupo de la hoja, cuando se asigna, entonces la operación continúa como antes.
- [x] `busQueries` no expone VIN, fotos ni métodos de escritura, y `route-sheets` no importa capas internas de Fleet.

## 8. Casos borde y errores

- **Validación omitida hoy:** `add-assignment-to-route-sheet.use-case.js` compara `bus.bus_group_id` solo si existe. Con el contrato camelCase esa condición nunca se cumpliría y un bus de otro grupo pasaría sin error, por eso el cambio de lectura y la prueba son obligatorios.
- **Días de parada:** `add-rest-day-to-route-sheet.use-case.js` no valida el grupo.
- **Lista vacía:** cooperativa o grupo sin buses devuelve `[]`.
- **Sin FK:** `route_sheet_assignments.bus_id` y `route_sheet_rest_days.bus_id` no referencian `buses`; la validación vive en el caso de uso. Agregar esa FK sería otra decisión y requeriría migración.
- **Bloqueos para ROUTE-SHEETS-02, fuera de esta tarea:** `frequencies` no publica `findById` ni activas por cooperativa, y su repositorio usa `findById(cooperativeId, id)` mientras `FrequencyQueryAdapter` llama `findById(id, cooperativeId)`. Además, sin `bookingRepository` el `BookingQueryAdapter` falla al consultar pasajeros.

## 9. Pruebas esperadas

- **Unitarias:** mapeo a `BusSummary`, identificadores no UUID, delegación de `busQueries`, adaptador y rechazo por grupo en ambos casos de uso.
- **Integración con PostgreSQL aislado:** aislamiento entre dos cooperativas en `PgBusRepository`, orden por unidad, y composición real de `createFleetModule` con `createRouteSheetsModule`, comprobando por HTTP el rechazo por grupo. Las frecuencias se sustituyen por un doble solo en esa prueba, porque su contrato pertenece a ROUTE-SHEETS-02.

## 10. Preguntas abiertas

- **Error de grupo.** Participantes: Edwin y David. Hoy se reutiliza `BusNotFromCooperativeError`, 403 con «El bus pertenece a otra cooperativa», falso cuando el bus es propio. Confirmación comunicada por Edwin en este chat: David aceptó BusNotInRouteSheetGroupError (BUS_NOT_IN_ROUTE_SHEET_GROUP, 409) en asignaciones y días de parada. No se recibió mensaje directo de David en esta sesión.
- **Cambio en `route-sheets`.** Participantes: Edwin y David. Es código de David, según la distribución de referencia. Recomendación: que el responsable de ese módulo confirme los archivos de la sección 3 antes de implementarlos, o bien que los haga en su propia rama sobre `busQueries`. Edwin comunicó expresamente que David confirmó este contrato y los cambios de T2.
- **Campos de `BusSummary`.** Edwin comunicó confirmación de David para id, cooperativeId, busGroupId, plate, unitNumber y capacity.

## 11. Defecto inducido (solo si aplica)

No aplica. Esta tarea no introduce ningún defecto autorizado.

## 12. Diseño SOLID y usabilidad

- **Responsabilidad única:** Fleet es dueño de la lectura; Route Sheets, de la regla de pertenencia a la hoja.
- **Inversión de dependencias:** Route Sheets depende de su `BusQueryPort`; la API se inyecta por composición, sin importar capas internas.
- **Segregación de interfaces:** `busQueries` publica solo lectura mínima.
- **Usabilidad:** no hay interfaz en este alcance, así que no se declara verificada. El error de grupo debe explicar la causa real para que una futura pantalla pueda mostrarla.

## 13. Plan y evidencias

1. **T1, Fleet:** puerto, `PgBusRepository`, `busQueries` y sus pruebas.
2. **T2, Route Sheets:** composición, adaptador, reglas de grupo y sus pruebas, tras resolver la sección 10.
3. **T3, verificación:** `npm run lint`, `npm run format:check` y `npm test` desde `backend/`, con PostgreSQL aislado según `docs/testing-database.md`. No cambia `server.js`, por lo que el arranque real no se ve afectado.

**Evidencia de T1, 31 de octubre de 2026** (Windows, PostgreSQL 16.13 en contenedor aislado, base `busesuta_test`):

- `npm run lint`: aprobado. Prettier: aprobado en los archivos del incremento; `npm run format:check` global señala 24 archivos, sin incluir los de este cambio.
- `npm test`: 776 unitarias aprobadas, con 9 nuevas. Integración: 221 aprobadas y 6 fallidas de 227, con las 7 nuevas de `bus-queries.test.js` aprobadas.
- Las 6 fallidas están en `bus.http.test.js`, cuyas fotos no aparecen en el directorio temporal que pasa a `start`. Coincide con el hallazgo de `server.js` descrito abajo; no se comprobó la suite con esa corrección aplicada.
- `database.test.js` agotó su límite de 20 s en una de las dos ejecuciones completas y aprobó en la otra y sin los cambios de T1: intermitente, ya descrito en FLEET-02.
- Sin cambios en `server.js`, migraciones ni pruebas existentes. El arranque real no se verificó porque la composición del servidor no cambia.

Hallazgo ajeno a esta tarea: `server.js` en `4f34748` llama `createFleetModule({ pool, auth })`, mientras `d0ef74e` pasaba también `env`. El merge de FLEET-02 lo perdió, por lo que `start(env)` ignora `BUS_PHOTO_STORAGE_DIR` cuando recibe un `env` propio, como hace `tests/integration/fleet/bus.http.test.js`. Requiere corrección separada.

## 14. Revisión y cierre

Sin revisión humana del código. Contrato de T2 confirmado por David según comunicación de Edwin; implementación y pruebas de sus criterios disponibles localmente. Cierre pendiente de validación de dependencias, publicación/revisión e integración.

### Continuación T2 autorizada y comprobada, 1 de noviembre de 2026

- Fuente humana: Edwin respondió «Sí, David confirmó ese contrato y los cambios» a la consulta que enumeró BusSummary y BUS_NOT_IN_ROUTE_SHEET_GROUP (409) en asignaciones y días de parada. Se registra como confirmación comunicada por Edwin, sin inventar respuesta directa ni aprobación de código por David.
- Composición de Route Sheets recibe fleet.busQueries; su adaptador delega los tres métodos públicos manteniendo argumentos/tenant, sin importar infraestructura de Fleet ni ocultar averías como listas vacías. Sustituye la entrada antigua busRepository por busQueries. Los consumidores deben inyectar la API pública, no un repositorio concreto.
- Asignaciones y días de parada comparan bus.busGroupId con el grupo de la hoja; pertenencia ausente/diferente se rechaza con el nuevo error de dominio 409 antes de consultar o guardar asignaciones/paradas. Bus ajeno/ausente mantiene BUS_NOT_FROM_COOPERATIVE (403). No se cambian reglas de frecuencias, pasajeros, estados ni activación de Route Sheets en server.js.
- Se conservan las nueve unitarias y siete integraciones de T1. T2 añade diez unitarias y doce integraciones HTTP con Fleet/Route Sheets reales y PostgreSQL aislado. Solo el proveedor de frecuencias usa un doble conforme a la spec; auth/sesión/CSRF, consultas de buses, repositorios y filas son reales. Cubre mismo grupo, distinto grupo, bus ajeno/ausente/UUID inválido y cooperativa enviada en body sin poder sustituir la autenticada.
- Pruebas dirigidas: 19 unitarias + 19 integraciones aprobadas (38). Lint aprobado; formato de archivos propios correcto. format:check global señala 21 archivos previos sin modificar; el formato de los tres archivos modificados de Route Sheets reduce los 24 anteriores a 21. No se reformatearon módulos ajenos, migraciones ni pruebas anteriores.
- Base comprobada: 4f34748, rama feature/FLEET-04-consulta-buses. PR #28 (08b7526) seguía abierta y pendiente de revisión al consultar. Su corrección de env no se incorpora al código ni al historial de esta rama: la suite real se ejecuta primero tal como está; luego se verifica una composición temporal en Docker con esa única línea, equivalente a la PR. Esa comprobación combinada no acredita que #28 ya esté integrada.
### Validación final, 1 de noviembre de 2026

Entorno: Node 24.21.0 en Docker, PostgreSQL 16.13 aislado con base busesuta_test y proyecto busesuta-fleet04-test; fuente montada en solo lectura y dependencias exactas del lock en volumen temporal. Sin lectura de .env, cambios al lock, nuevas dependencias ni aumento de timeout.

| Comprobación | Resultado real |
|---|---|
| Dirigidas T1/T2 | 19 unitarias + 19 integraciones HTTP/BD aprobadas (38 total) |
| Lint de la rama | Aprobado |
| Suite completa sobre los archivos reales de esta rama | 786 unitarias aprobadas; integración 233 aprobadas y 6 fallidas de 239, todas de bus.http.test.js por el env perdido en server.js. Ejecución fallida, sin omisiones |
| Suite completa con únicamente la corrección de env montada temporalmente en Docker | Lint aprobado y 786 unitarias + 239 integraciones aprobadas: 1025 pruebas en 74 suites; integración en 62,582 s |
| Formato de todos los JS nuevos/modificados | Aprobado |
| format:check global | Fallido: 21 archivos preexistentes sin modificar |
| git diff --check | Aprobado |

El montaje combinado sustituye solo createFleetModule({ pool, auth }) por createFleetModule({ pool, auth, env }) dentro del contenedor; se comprobó que su contenido coincide con el server.js de la rama de PR #28. El archivo real backend/src/server.js no se modificó. La combinación incluye las pruebas que usan start real, además de la composición HTTP de Fleet/Route Sheets. No se afirma que Route Sheets esté montado en el servidor de producción: eso sigue fuera de esta tarea.

Los fallos de la primera suite no se ocultan ni se convierten en aprobados. La segunda ejecución acredita compatibilidad con esa corrección concreta, no integración de la PR completa ni nueva revisión de sus otros cambios. No se aplicaron merge/rebase, cambios de rama, commit ni push. No se alteraron pruebas anteriores ni archivos de pagos, frecuencias, reservas o migraciones. Recursos temporales retirados al terminar.

Implementación de los criterios de FLEET-04 completada: lecturas públicas mínimas, pertenencia por grupo y aislamiento probados. La confirmación del contrato de David comunicada por Edwin autoriza T2; no sustituye revisión de código. Próximo paso: resolver revisión/integración de la PR #28, repetir la comprobación sobre la base integrada y preparar commits/PR de FLEET-04 cuando Edwin lo pida. Propuesta de separación lógica: feat(flota): expone consultas de buses por cooperativa; fix(hojas-ruta): valida el grupo del bus en asignaciones y paradas. Ambos con Refs: docs/specs/FLEET-04.md. No marcar Integrada ni Cerrada.
### Actualización de base solicitada por Edwin, 1 de noviembre de 2026

PR #28 comprobada MERGED en b1e6720 (integración 1 de noviembre, 12:27:55 America/Guayaquil). Se actualizó feature/FLEET-04-consulta-buses por avance directo desde 4f34748 a b1e6720, sin commit de fusión ni rebase ni cambio a develop. Se protegieron y restauraron los cambios locales: los 13 archivos propios distintos del registro compartido conservaron hashes idénticos. El único conflicto al restaurar afectó docs/estado-proyecto.md; se conciliaron filas de Fleet preservando la información de ambas versiones y retirando duplicados. Ningún archivo de negocio de FLEET-04 cambió en esta actualización.

La corrección de env ya pertenece a la base real, no a un montaje temporal. Se repite lint/formato/suite completa con PostgreSQL aislado sobre esta base; resultado definitivo a continuación. No se crea commit ni se publica FLEET-04 por esta solicitud. La rama remota FRONT-01-T3c-cliente-http (144f1f7) se inspeccionó solo para orientar dependencias: no se incorporó ni se considera integrada.

Resultado definitivo sobre base real b1e6720: lint aprobado; npm test aprobó 786 unitarias y 239 integraciones (1025 pruebas, 74 suites), integración en 74,184 s. Pasaron también los seis casos de fotos que fallaban antes. Sin montaje correctivo de server.js ni modificación de pruebas, timeouts o dependencias. Formato de todos los JS propios correcto y git diff --check aprobado; format:check global falla en 20 archivos previos fuera de alcance. El paso pendiente es preparar commits atómicos y PR de FLEET-04 por petición humana, obtener revisión de código y verificar su integración. Ya no depende de integrar PR #28. Recursos de prueba retirados al terminar.

### Publicación solicitada por Edwin, 1 de noviembre de 2026

Edwin pidió guardar la PR de FLEET-04. Se separó T1 (consultas Fleet) en 3ddfc26; este segundo commit contiene T2 (composición y pertenencia al grupo), pruebas y evidencia final. Base remota comprobada b1e6720 y sin PR previa para esta rama. Se publicará feature/FLEET-04-consulta-buses hacia develop con revisión humana pendiente. Los 1025 casos aprobados corresponden a los archivos funcionales finales; esta preparación solo divide los commits y actualiza documentación. Lint y formato propio correctos; formato global pendiente en 20 archivos anteriores. Asistencia de Codex en implementación, pruebas y preparación de PR; no sustituye revisión humana ni autoriza defectos inducidos.
