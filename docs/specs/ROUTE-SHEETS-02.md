# ROUTE-SHEETS-02: Integración operativa de hojas de ruta

- **ID local:** ROUTE-SHEETS-02
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** `route-sheets` / composición de backend
- **Responsable:** David (confirmado por el usuario)
- **Revisor propuesto / confirmado:** Leslie / pendiente de confirmación
- **Estado:** Borrador
- **Prioridad y dependencias:** ROUTE-SHEETS-01, FREQ-01 y FLEET-04; consulta de buses disponible en `develop` `efcfcf2`. Propuestas de contratos públicos de `frequencies` y `bookings` documentadas abajo; confirmación de Pablo y Leslie pendiente.
- **Rama / PR / base comprobada:** `feature/ROUTE-SHEETS-02-integracion-operativa`; sin PR conocido; rebase completado el 1 de noviembre de 2026 sobre la referencia local `origin/develop` `efcfcf2`, con la spec en `0c6ebb4`. No se pudo refrescar la referencia desde el remoto durante esta revisión.
- **Autorización de alcance:** David confirma excluir búsqueda pública y catálogo de viajes de esta spec. Las propuestas de contratos compartidos están redactadas; su aceptación por Pablo y Leslie y la autorización final de implementación siguen pendientes.

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

**Incluye, sujeto a cerrar las preguntas de la sección 10:**

- Componer `frequencies` y `route-sheets` en el arranque de producción (`server.js`) y montarlos mediante la composición existente de `app.js`.
- Definir y conectar las dependencias de `route-sheets` con APIs públicas de los módulos proveedores, sin importar sus capas internas.
- Verificar la autenticación, autorización, aislamiento por cooperativa y consultas necesarias para los casos de uso de ROUTE-SHEETS-01.
- Añadir o ajustar pruebas de composición y de integración del servidor que acrediten el recorrido configurado.
- Registrar en esta spec los contratos acordados, evidencias y resultados.

**No incluye:**

- Reimplementar o ampliar los casos de uso de ROUTE-SHEETS-01 o FREQ-01, salvo el cambio mínimo de API pública que se acuerde como requisito de composición.
- Implementar registro/consulta de buses o cambiar el módulo `fleet`; esos cambios corresponden a su responsable y requieren su propia spec.
- Implementar persistencia o reglas de reservas para responder consultas de pasajeros; dependen de un contrato de `bookings` acordado con Leslie.
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

La consulta de buses y la validación de grupo ya están disponibles mediante FLEET-04. El comportamiento de los casos de uso que dependen de pasajeros todavía requiere un contrato aprobado de `bookings`.

## 5. Datos

- No se propone crear ni alterar tablas o migraciones.
- Se reutilizan los datos y DTO definidos en ROUTE-SHEETS-01 y FREQ-01.
- La fábrica actual `createRouteSheetsModule` recibe `pool`, `auth`, `frequencyRepository`, `busGroupQueries`, `busQueries` y `bookingRepository`. Para respetar la frontera entre módulos, la propuesta es inyectar APIs públicas de consulta (`frequencyQueries`, `busQueries`, `bookingQueries`), no repositorios/adaptadores internos de otros módulos.
- El `cooperative_id` de solicitudes internas debe derivarse de la identidad autenticada; no se aceptará uno elegido por el body.
- FREQ-01 expone hoy `findActiveByRoute` desde `frequencies/index.js`; ROUTE-SHEETS-01 requiere consultas de frecuencias por ID, por cooperativa y con paradas, por lo que ese contrato aún debe acordarse. FLEET-04 ya resuelve la consulta interna de buses mediante `fleet.busQueries`. No se identifica una API pública de producción de `bookings` para las consultas de pasajeros requeridas por ROUTE-SHEETS-01.

### 5.1 Propuesta de consulta pública de frecuencias — pendiente de Pablo

Exponer desde la API pública del módulo `frequencies` un objeto de solo lectura `frequencyQueries` con estas operaciones, siempre filtradas por `cooperativeId`:

| Operación propuesta | Resultado propuesto |
|---|---|
| `findById(id, cooperativeId)` | Resumen de frecuencia o `null` si no existe dentro de esa cooperativa |
| `findActiveByCooperativeId(cooperativeId)` | Lista de resúmenes activos; arreglo vacío si no hay frecuencias activas |
| `findWithStops(id, cooperativeId)` | Detalle con paradas ordenadas o `null` si no existe dentro de esa cooperativa |

DTO propuesto `FrequencySummary`: `{ id, cooperativeId, origin, destination, departureTime, antResolutionNumber, status }`. `FrequencyDetail` agrega `stops` en orden operativo. El repositorio de frecuencias actual puede seguir usando sus argumentos internos y traducirlos en la API del módulo; `route-sheets` no lo importa. Los errores técnicos se propagan y no se sustituyen con listas vacías o valores nulos. Pablo debe confirmar o proponer ajustes antes de implementar este contrato.

### 5.2 Propuesta de consulta de pasajeros — pendiente de Leslie

Exponer desde la API pública de `bookings` un objeto de solo lectura `bookingQueries` con las operaciones que ya requiere `BookingQueryPort`:

| Operación propuesta | Entrada | Resultado propuesto |
|---|---|---|
| `hasPassengersForBusOnRouteSheet(routeSheetId, busId, cooperativeId)` | Hoja, bus y cooperativa | Booleano sobre pasajeros/reservas que afectan a ese bus en la hoja |
| `hasPassengersForAssignment(assignmentId, cooperativeId)` | Asignación y cooperativa | Booleano sobre pasajeros/reservas que afectan a la asignación |

Ambas consultas deben aislar por cooperativa. `false` significa que la consulta terminó correctamente y confirmó que no existen pasajeros que afecten el cambio. Si el proveedor no está disponible o la consulta falla, las operaciones que requieren esta comprobación no continúan; el error técnico se propaga con el formato HTTP común. Leslie debe precisar qué estados de reserva cuentan como pasajeros y confirmar o ajustar este contrato.

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
- [ ] Los contratos de bus/grupo y consulta de pasajeros están definidos con sus responsables antes de habilitar en producción los casos de uso que dependen de ellos.
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

1. **API pública de frecuencias — Pablo y David, pendiente:** `route-sheets` necesita consultar frecuencias por cooperativa, por ID y con paradas, mientras `frequencies/index.js` expone actualmente `findActiveByRoute`. Hay que acordar operaciones y DTOs; no importar el repositorio PostgreSQL de `frequencies` desde `route-sheets`.
2. **Consulta de buses — resuelta por FLEET-04:** `fleet.busQueries` ofrece búsquedas por ID, grupo y cooperativa con filtro multi-tenant; Route Sheets ya recibe `busQueries` en su composición y valida la pertenencia al grupo al asignar o registrar días de parada. No duplicar esas consultas ni importar infraestructura interna de Fleet.
3. **Consulta de pasajeros — Leslie, propuesta pendiente:** David propone `bookingQueries.hasPassengersForBusOnRouteSheet` y `hasPassengersForAssignment`, con aislamiento por cooperativa y resultado `false` solo ante consulta exitosa sin pasajeros que afecten el cambio. Fallo/ausencia del proveedor debe impedir el cambio. Falta que Leslie defina los estados que cuentan y confirme o ajuste el contrato.
4. **Límite de esta spec — decisión de David:** búsqueda pública y catálogo de viajes/`Trip` quedan fuera de ROUTE-SHEETS-02 y se tratarán después en una tarea/spec separada. No se implementan en esta rama.
5. **Revisión — Leslie, propuesta pendiente:** David propone a Leslie como revisora. Su aceptación debe registrarse antes de la revisión; no se presume por esta propuesta.

Registrar las respuestas humanas reales y los contratos acordados según `docs/equipo-y-acuerdos.md`. La API de buses de FLEET-04 y el límite de búsqueda/catálogo quedan resueltos para esta spec. Mientras Pablo y Leslie no confirmen los contratos propuestos, ROUTE-SHEETS-02 permanece en Borrador y no autoriza implementar la integración dependiente.

## 11. Defecto inducido

No aplica a esta propuesta. No introducir defectos inducidos sin autorización documentada conforme a `docs/errores-inducidos.md`.

## 12. Diseño SOLID y usabilidad

- Respetar la inversión de dependencias: `route-sheets` define sus puertos y los módulos proveedores implementan/exponen contratos a través de sus APIs públicas.
- Mantener composición e instanciación en el arranque; no crear dependencias concretas dentro de casos de uso.
- No se modifica una interfaz de usuario en esta spec. La usabilidad de vistas se documentará y verificará en ROUTE-SHEETS-03.

## 13. Plan y evidencias

1. **Delimitar contratos:** resolver las preguntas abiertas y registrar participantes, decisión, DTOs y operaciones acordadas.
2. **Componer módulos:** conectar únicamente APIs públicas aprobadas y actualizar las pruebas de arranque/composición.
3. **Verificar:** ejecutar lint, formato, suite de pruebas y arranque con PostgreSQL aislado; guardar resultados reales.
4. **Actualizar estado:** registrar evidencia de ROUTE-SHEETS-02 en `docs/estado-proyecto.md`; mantener Borrador hasta que el alcance se confirme.

**Evidencia actualizada el 1 de noviembre de 2026:** rebase local completado en `0c6ebb4` sobre la referencia local `origin/develop` `efcfcf2`. `app.js` admite las rutas, pero `server.js` todavía no instancia Route Sheets. FLEET-04 expone `fleet.busQueries` y valida pertenencia al grupo. `frequencies` continúa exponiendo solo `findActiveByRoute`; no se identificó un contrato público de producción de `bookings` para consultas de pasajeros. No se ejecutaron pruebas porque esta sección modifica solo documentación.

## 14. Revisión y cierre

- **Revisor humano:** propuesto Leslie; confirmación pendiente.
- **PR e integración:** pendientes. La rama es local; no se afirma que esté publicada.
- **Cierre:** requiere aprobación humana, integración en `develop` y verificación posterior según `docs/flujo-codex.md`.
- **Próxima acción:** obtener de Pablo y Leslie la aceptación o cambios a las propuestas de las secciones 5.1 y 5.2, y confirmar si Leslie acepta revisar. Luego aprobar el alcance y autorizar la implementación.
