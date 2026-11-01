# FLEET-04: Consultar buses registrados desde Route Sheets

- **ID local:** FLEET-04; libre en las specs y ramas accesibles al comprobarlo el 31 de octubre de 2026.
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** `fleet`; ajuste acotado en `route-sheets`
- **Responsable:** Edwin, responsable de Fleet y solicitante de completar esta tarea
- **Revisor propuesto / confirmado:** David propuesto para revisión de código, pendiente. Edwin comunicó su confirmación del contrato y los cambios de T2; no equivale a revisión de código aprobada
- **Estado:** T1 implementado y verificado; T2 aprobado por confirmación de David comunicada por Edwin, se conserva para el siguiente commit
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

- [ ] Dado un bus de la cooperativa A, cuando la cooperativa B lo consulta por `findById`, entonces recibe `null`.
- [ ] Dados buses de A y B, cuando se lista por cooperativa o por grupo, entonces solo aparecen los de la cooperativa indicada, también si B usa un `busGroupId` de A.
- [ ] Dado un bus del grupo X, cuando se asigna a una hoja del grupo Y de la misma cooperativa, entonces se rechaza y no se guarda nada.
- [ ] Dado un bus del grupo X, cuando se registra como día de parada en una hoja del grupo Y, entonces se rechaza y no se guarda nada.
- [ ] Dado un bus de otra cooperativa, cuando se asigna o se registra su parada, entonces responde `BUS_NOT_FROM_COOPERATIVE`.
- [ ] Dado un bus del grupo de la hoja, cuando se asigna, entonces la operación continúa como antes.
- [ ] `busQueries` no expone VIN, fotos ni métodos de escritura, y `route-sheets` no importa capas internas de Fleet.

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

Sin revisión humana del código. Contrato de T2 confirmado por David según comunicación de Edwin; implementación y pruebas de T2 reservadas para el siguiente commit. Cierre pendiente de validación de dependencias, publicación/revisión e integración.


### Guardado T1 solicitado por Edwin, 1 de noviembre de 2026

Edwin pidió guardar FLEET-04 y abrir su PR. Este primer commit contiene exclusivamente las lecturas de Fleet y nueve pruebas unitarias/siete integraciones, aprobadas en la validación local. Base actual b1e6720 con PR #28 integrada. Los resultados históricos fallidos se conservan; T2 de Route Sheets y la validación final completa se guardan en el siguiente commit. Revisión humana e integración pendientes.
