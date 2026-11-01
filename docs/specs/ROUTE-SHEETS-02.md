# ROUTE-SHEETS-02: Integración operativa de hojas de ruta

- **ID local:** ROUTE-SHEETS-02
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** `route-sheets` / composición de backend
- **Responsable:** David (confirmado por el usuario)
- **Revisor propuesto / confirmado:** Leslie / aceptación reportada por David; revisión de código pendiente
- **Estado:** En desarrollo
- **Prioridad y dependencias:** ROUTE-SHEETS-01, FREQ-01 y FLEET-04. Contratos públicos de consulta de frecuencias y reservas confirmados según lo reportado por David el 1 de noviembre de 2026. La implementación productiva de consultas de reservas depende de que BOOK-03 defina y persista sus datos.
- **Rama / PR / base comprobada:** `feature/ROUTE-SHEETS-02-integracion-operativa`; sin PR conocido; rebase completado el 1 de noviembre de 2026 sobre la referencia local `origin/develop` `efcfcf2`. Commits de ROUTE-SHEETS-02 en la rama hasta `d6c3bf9`; no se pudo refrescar la referencia desde el remoto durante esta revisión.
- **Autorización de alcance:** David confirma excluir búsqueda pública y catálogo de viajes de esta spec y autoriza implementar la integración, incluidos cambios mínimos a módulos proveedores. David reporta que Pablo aceptó el contrato de frecuencias y Leslie aceptó el contrato de reservas el 1 de noviembre de 2026. No se atribuye a ellos una definición de esquema que BOOK-03 mantiene pendiente.

## 1. Objetivo

Conectar la funcionalidad ya desarrollada de `frequencies` y `route-sheets` con el arranque real del backend y definir cómo `route-sheets` consume la información de los módulos relacionados, usando solamente sus APIs públicas. El resultado debe permitir comprobar en el servidor real los recorridos existentes de hojas de ruta y mantener los límites de cada módulo.

Esta spec delimita la integración operativa posterior a ROUTE-SHEETS-01. No vuelve a implementar sus entidades, casos de uso, persistencia ni vistas.

## 2. Reglas de negocio involucradas

- **RN-02:** los datos internos de una cooperativa se consultan usando la identidad autenticada y deben permanecer aislados por `cooperative_id`.
- **RN-23:** las asignaciones de hojas de ruta aceptan solo frecuencias activas.
- **RN-30:** cada hoja de ruta enlaza un grupo de buses con frecuencias activas dentro de su cooperativa.
- **RN-31 y RN-32:** se conservan los flujos manual/automático y los días de parada ya definidos en ROUTE-SHEETS-01; esta integración no cambia sus reglas.

No se agregan ni modifican reglas de negocio en esta propuesta.

## 3. Alcance

**Incluye:**

- Componer `frequencies` y `route-sheets` en el arranque de producción (`server.js`) y montarlos mediante la composición existente de `app.js`.
- Definir y conectar las dependencias de `route-sheets` con APIs públicas de los módulos proveedores, sin importar sus capas internas.
- Verificar la autenticación, autorización, aislamiento por cooperativa y consultas necesarias para los casos de uso de ROUTE-SHEETS-01.
- Añadir o ajustar pruebas de composición y de integración del servidor que acrediten el recorrido configurado.
- Registrar en esta spec los contratos acordados, evidencias y resultados.

**No incluye:**

- Reimplementar o ampliar los casos de uso de ROUTE-SHEETS-01 o FREQ-01, salvo el cambio mínimo de API pública que se acuerde como requisito de composición.
- Implementar registro/consulta de buses o cambiar el módulo `fleet`; esos cambios corresponden a su responsable y requieren su propia spec.
- Crear el esquema de reservas o implementar casos de uso de compra; corresponden a BOOK-03 y requieren sus contratos de viaje/asiento.
- Implementar búsqueda pública, un catálogo de viajes/`Trip` o una API de búsqueda. La asignación y spec de `search` están pendientes de confirmación.
- Implementar vistas. El usuario indicó que las vistas se delimitarán en ROUTE-SHEETS-03.
- Cambiar migraciones existentes, reglas RN, precios, ventana de compra o criterio de generación automática.

## 4. Flujo principal

Flujo propuesto para verificar una vez acordadas las dependencias:

1. El servidor inicializa la base de datos y los módulos de autenticación y dependencias requeridas.
2. La composición crea `frequencies` y `route-sheets`, inyectando solamente contratos expuestos por APIs públicas.
3. `app.js` monta los routers existentes bajo `/api/v1/frequencies` y `/api/v1/route-sheets`.
4. Una solicitud autenticada a hojas de ruta llega al caso de uso correspondiente; las consultas usan el contexto de cooperativa de la identidad y validan las reglas ya especificadas.
5. Las pruebas de integración y una comprobación del arranque real demuestran que la composición funciona con las dependencias acordadas.

La consulta de buses y la validación de grupo ya están disponibles mediante FLEET-04. El contrato de `bookingQueries` está aceptado según el reporte de David, pero sus consultas productivas esperan el esquema de reservas/ocupaciones de BOOK-03; hasta entonces las operaciones afectadas fallan cerrado.

## 5. Datos

- No se propone crear ni alterar tablas o migraciones.
- Se reutilizan los datos y DTO definidos en ROUTE-SHEETS-01 y FREQ-01.
- La fábrica de `createRouteSheetsModule` recibe `pool`, `auth`, `frequencyQueries`, `busGroupQueries`, `busQueries` y `bookingQueries`. La API pública de `fleet.busQueries` está implementada por FLEET-04. Las consultas públicas de frecuencias se implementan en esta spec. `bookingQueries` es el contrato público aceptado; el módulo proveedor aún no puede implementarse contra PostgreSQL hasta que BOOK-03 defina y persista reservas y ocupaciones.
- El `cooperative_id` de solicitudes internas debe derivarse de la identidad autenticada; no se aceptará uno elegido por el body.
- FREQ-01 expone `findActiveByRoute`; esta spec añade a `frequencies/index.js` las consultas públicas por ID, cooperativa y detalle con paradas. FLEET-04 resuelve la consulta interna de buses mediante `fleet.busQueries`. `bookings` aún no expone consultas productivas porque BOOK-03 no define persistencia de reservas/ocupaciones.

### 5.1 Contrato de consulta pública de frecuencias — aceptado según reporte de David

Exponer desde la API pública del módulo `frequencies` un objeto de solo lectura `frequencyQueries` con estas operaciones, siempre filtradas por `cooperativeId`:

| Operación | Resultado |
|---|---|
| `findById(id, cooperativeId)` | Resumen de frecuencia o `null` si no existe dentro de esa cooperativa |
| `findActiveByCooperativeId(cooperativeId)` | Lista de resúmenes activos; arreglo vacío si no hay frecuencias activas |
| `findWithStops(id, cooperativeId)` | Detalle con paradas ordenadas o `null` si no existe dentro de esa cooperativa |

DTO `FrequencySummary`: `{ id, cooperativeId, origin, destination, departureTime, antResolutionNumber, status }`. `FrequencyDetail` agrega `stops` en orden operativo. El repositorio de frecuencias mantiene sus argumentos internos y la API del módulo traduce al DTO; `route-sheets` no lo importa. Solo una frecuencia inexistente/ajena se traduce a `null`; los errores técnicos se propagan.

### 5.2 Contrato de consulta de pasajeros — aceptado según reporte de David

Exponer desde la API pública de `bookings` un objeto de solo lectura `bookingQueries` con las operaciones que ya requiere `BookingQueryPort`:

| Operación | Entrada | Resultado |
|---|---|---|
| `hasPassengersForBusOnRouteSheet(routeSheetId, busId, cooperativeId)` | Hoja, bus y cooperativa | Booleano sobre pasajeros/reservas que afectan a ese bus en la hoja |
| `hasPassengersForAssignment(assignmentId, cooperativeId)` | Asignación y cooperativa | Booleano sobre pasajeros/reservas que afectan a la asignación |

Ambas consultas deben aislar por cooperativa. Para este contrato cuentan las ocupaciones efectivas `RESERVED` y `SOLD`, incluidas las reservas cuyo comprobante espera revisión, conforme a BOOK-02. `false` significa que la consulta terminó correctamente y no encontró esas ocupaciones. Si el proveedor no está disponible o falla, las operaciones que requieren la comprobación no continúan; la ausencia del proveedor responde 503 y un fallo técnico conserva el formato HTTP común. El proveedor PostgreSQL queda pendiente de BOOK-03, que aún no define tablas de reservas/ocupaciones ni la relación persistida con viaje y hoja de ruta.

### 5.3 Registro de confirmación compartida

- **Estado:** Contratos aceptados según reporte de David; proveedor de reservas pendiente por dependencia de esquema.
- **Fecha y participantes consultados:** 1 de noviembre de 2026. David reporta haber consultado a Pablo (frecuencias) y Leslie (reservas y revisión). Codex no se comunicó directamente con ellos.
- **Specs y contratos afectados:** ROUTE-SHEETS-02 §5.1–§5.2, FREQ-01, BOOK-02 y BOOK-03.
- **Decisión:** exponer `frequencyQueries` y `bookingQueries` como APIs públicas de solo lectura. En reservas cuentan ocupaciones `RESERVED` y `SOLD`; errores o proveedor ausente no se interpretan como ausencia de pasajeros.
- **Responsable de aplicación:** David en ROUTE-SHEETS-02; Leslie mantiene la implementación del módulo bookings según BOOK-01.
- **Revisión:** Leslie aceptó según reporte de David; la revisión humana del código y la aprobación de PR siguen pendientes.
- **Impacto:** la consulta pública de frecuencias y su composición se implementan aquí. El adaptador de reservas valida la frontera y falla cerrado; no se crea esquema ni consulta SQL hasta que BOOK-03 establezca sus entidades y relaciones.

## 6. Endpoints

No se proponen rutas nuevas. Se deben montar las rutas existentes:

| Método | Ruta | Roles | Respuestas |
|---|---|---|---|
| Según ROUTE-SHEETS-01 | `/api/v1/route-sheets/...` | Según ROUTE-SHEETS-01 | Según ROUTE-SHEETS-01 |
| Según FREQ-01 | `/api/v1/frequencies/...` | Según FREQ-01 | Según FREQ-01 |

La composición de producción debe conservar los middlewares de autenticación, autorización y CSRF ya definidos por esos módulos.

## 7. Criterios de aceptación

- [ ] Dado el servidor configurado con la base de datos de pruebas, cuando se ejecuta su punto de arranque, entonces crea y monta los módulos acordados sin requerir inyección manual exclusiva de las pruebas de `app.js`.
- [ ] Dada una consulta interna de hoja de ruta, cuando se resuelven dependencias entre módulos, entonces se usan únicamente APIs públicas y se conserva el filtro por cooperativa autenticada.
- [ ] Dada una asignación a frecuencia, cuando se consulta la dependencia acordada, entonces se conserva la validación de frecuencia activa y pertenencia establecida por ROUTE-SHEETS-01.
- [ ] Los casos de uso dependientes de pasajeros solo se habilitan cuando bookings proporcione la API implementada; mientras no exista proveedor, responden error y no continúan el cambio.
- [ ] Las pruebas de integración cubren montaje y una operación de hojas de ruta contra PostgreSQL aislado; se verifica también el arranque real.
- [ ] Lint, formato y pruebas se ejecutan desde `backend/`; sus resultados reales se registran aquí.

## 8. Casos borde y errores

- Error al conectar la base de datos o crear un módulo durante el arranque: definir y verificar el manejo de recursos según el patrón de `server.js`.
- Módulo proveedor o contrato requerido ausente: definir el comportamiento esperado antes de codificarlo; en particular, no tratar la ausencia o fallo de `bookings` como “sin pasajeros”. Revisar los adaptadores de frecuencias para que la integración no convierta contratos incompletos en resultados vacíos o `null`.
- Identificador de otra cooperativa: las operaciones internas deben preservar el comportamiento de aislamiento definido en RN-02 y ROUTE-SHEETS-01.
- Frecuencia inexistente, inactiva o ajena a la cooperativa: conservar los errores de dominio definidos por ROUTE-SHEETS-01.

## 9. Pruebas esperadas

- **Unitarias:** pruebas de los adaptadores/composición si se añade o cambia su contrato; no duplicar pruebas de dominio ya cubiertas por ROUTE-SHEETS-01.
- **Integración:** montaje de rutas por `app.js`, aislamiento por cooperativa y acceso a las dependencias públicas acordadas usando PostgreSQL aislado según `docs/testing-database.md`.
- **Arranque:** prueba o comprobación reproducible de `server.js` con entorno de prueba, incluyendo cierre del pool ante fallo.
- **Calidad:** ejecutar `npm run lint`, `npm run format:check` y `npm test` desde `backend/`; reportar resultados reales y no ocultar fallos preexistentes.

## 10. Preguntas abiertas

1. **API pública de frecuencias — resuelta según reporte de David:** se implementa `frequencyQueries` con aislamiento por cooperativa y DTOs en §5.1.
2. **Consulta de buses — resuelta por FLEET-04:** `fleet.busQueries` ofrece búsquedas por ID, grupo y cooperativa con filtro multi-tenant; Route Sheets ya recibe `busQueries` en su composición y valida la pertenencia al grupo al asignar o registrar días de parada. No duplicar esas consultas ni importar infraestructura interna de Fleet.
3. **Consulta de pasajeros — contrato resuelto según reporte de David; proveedor pendiente:** operaciones y estados `RESERVED`/`SOLD` quedan registrados en §5.2. BOOK-03 todavía no define esquema ni persistencia, por lo que no se inventa una implementación SQL.
4. **Límite de esta spec — decisión de David:** búsqueda pública y catálogo de viajes/`Trip` quedan fuera de ROUTE-SHEETS-02 y se tratarán después en una tarea/spec separada. No se implementan en esta rama.
5. **Revisión — Leslie aceptó según reporte de David:** su aprobación del código y de la PR siguen pendientes y no se deducen del contrato.

La respuesta humana comunicada por David está registrada en §5.3 y en `docs/estado-proyecto.md`. La API de buses de FLEET-04 y el límite de búsqueda/catálogo quedan resueltos para esta spec. La integración puede avanzar con los contratos aceptados; el proveedor PostgreSQL de reservas permanece bloqueado por el esquema aún pendiente de BOOK-03.

## 11. Defecto inducido

No aplica a esta propuesta. No introducir defectos inducidos sin autorización documentada conforme a `docs/errores-inducidos.md`.

## 12. Diseño SOLID y usabilidad

- Respetar la inversión de dependencias: `route-sheets` define sus puertos y los módulos proveedores implementan/exponen contratos a través de sus APIs públicas.
- Mantener composición e instanciación en el arranque; no crear dependencias concretas dentro de casos de uso.
- No se modifica una interfaz de usuario en esta spec. La usabilidad de vistas se documentará y verificará en ROUTE-SHEETS-03.

## 13. Plan y evidencias

1. **Registrar contratos:** decisión reportada por David documentada en §5.3.
2. **Conectar frecuencias y composición:** publicar consultas públicas de frecuencias, inyectar APIs públicas de Fleet y frecuencias y montar el router al arranque.
3. **Asegurar consultas de reservas:** adaptar el contrato público y fallar cerrado hasta que BOOK-03 provea consultas persistidas.
4. **Verificar:** ejecutar lint, formato, suite de pruebas y arranque con PostgreSQL aislado; guardar resultados reales.
5. **Actualizar estado:** registrar evidencia y dependencias pendientes en `docs/estado-proyecto.md`.

**Evidencia actualizada el 1 de noviembre de 2026:** rama en `d6c3bf9`, sobre la base local `origin/develop` `efcfcf2`. FLEET-04 expone `fleet.busQueries` y valida pertenencia al grupo. `server.js` compone `frequencies` y `route-sheets`; `app.js` monta `/api/v1/route-sheets`. `frequencies` expone `frequencyQueries` mediante su API pública. `bookings` no tiene repositorio ni esquema de producción para reservas y ocupaciones; cuando una operación requiere esa consulta y no existe proveedor, Route Sheets falla con 503. La consulta SQL real queda pendiente de BOOK-03.

**Sección 1, consumidor de frecuencias:** `FrequencyQueryAdapter` recibe `frequencyQueries`, delega las consultas por ID, frecuencias activas por cooperativa y detalle con paradas, valida el contrato al componer y propaga los errores del proveedor. No accede al repositorio de Frequencies.

**Sección 2, proveedor de frecuencias y composición operativa:** se añade `frequencyQueries` a la API pública de frequencies con consulta por ID, listado activo aislado y detalle con paradas. `server.js` instancia Route Sheets e inyecta `frequencyQueries`, `fleet.busQueries` y `fleet.busGroupQueries`; `app.js` ya monta `/api/v1/route-sheets`. La dependencia de reservas cambia a `bookingQueries`, exige ambas operaciones si hay proveedor, valida respuestas booleanas y propaga fallos. Si no existe proveedor, las operaciones afectadas fallan con 503 en vez de continuar como si no hubiera pasajeros.

**Verificación de código registrada el 1 de noviembre de 2026:** `npm run lint` aprobado; 20 suites unitarias dirigidas de Frequencies, Route Sheets y arranque aprobadas (196 pruebas); Prettier de los archivos modificados y `git diff --check` aprobados. `npm test` ejecutó las unitarias: 54 suites aprobaron y 2 suites fallaron (765 pruebas aprobadas, 3 fallidas) por `busboy` ausente en `fleet/bus-upload.test.js` y errores `EACCES` de loopback en `payments/payment-proof.routes.test.js`; por el fallo de la etapa unitaria no se ejecutaron integraciones. `npm run format:check` global señala 43 archivos preexistentes, ninguno de esta sección. Docker Compose no pudo iniciar PostgreSQL porque Docker Desktop no estaba disponible; la integración y el arranque real con PostgreSQL siguen sin verificar.

**Dependencia pendiente:** no se implementa una consulta PostgreSQL de reservas porque BOOK-03 no tiene esquema ni relación persistida con hojas de ruta/asignaciones. Los estados de ocupación que deberán contarse (`RESERVED`, `SOLD`) vienen de BOOK-02. Al completar BOOK-03, Leslie debe exponer estas consultas en la API pública de bookings e inyectarlas al componer Route Sheets. Esta rama no crea tablas ni migraciones.

## 14. Revisión y cierre

- **Revisor humano:** Leslie aceptó según reporte de David; revisión de código pendiente.
- **PR e integración:** pendientes. La rama es local; no se afirma que esté publicada.
- **Cierre:** requiere aprobación humana, integración en `develop` y verificación posterior según `docs/flujo-codex.md`.
- **Próxima acción:** verificar esta rama en la suite completa y arranque aislado. Luego, cuando BOOK-03 persista reservas/ocupaciones, conectar su API pública `bookingQueries`; la revisión humana y la integración siguen pendientes.
