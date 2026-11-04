# ROUTE-SHEETS-07: Viajes comercializables con identidad estable

- **Referencia de planificación:** D-04; referencia local, sin ticket externo.
- **Responsable:** David, por actividad seleccionada por el solicitante.
- **Estado:** Secciones 0 y 1 guardadas por el humano (4e5c8df y 2e3cdca). Sección 2 implementada localmente; revisión humana e integración pendientes.
- **Fecha:** 2 de noviembre de 2026, America/Guayaquil.
- **Rama / base comprobada:** feature/ROUTE-SHEETS-07-viajes-comercializables, 1dcbd6d; inicialmente limpia. La base contiene integración de D-03 mediante PR #48. No se refrescó remoto en esta sección; en la revisión anterior origin/develop se comprobó en ese mismo commit.
- **Revisora propuesta:** Leslie; aceptación de revisar esta tarea pendiente. Edwin participa en el contrato de inventario. No se atribuyen aprobaciones individuales nuevas.
- **Autorización:** David confirmó Q1–Q4 y las adaptaciones de preparación registradas en sección 1. El 2 de noviembre autorizó sección 2 y confirmó Q5: ambas funciones y DTO como API interna, sin GET público ni cambios en Bookings. No solicitó commits ni publicación; no se atribuyen aprobaciones individuales a Leslie/Edwin.

## 1. Objetivo y fuentes

Identificar cada salida comercial de forma estable y entregar a Reservas/búsqueda información verificable de viaje, recorrido, tarifa e inventario. Una frecuencia no es un viaje y una hoja publicada por sí sola no acredita inventario comercial congelado.

Fuentes: [reglas de negocio](../business-rules.md), RN-02, RN-12, RN-20–23, RN-30–32 y RN-40; [acuerdos](../acuerdos-primera-entrega.md), [arquitectura](../architecture.md), [convenciones](../conventions.md), [calidad](../calidad.md), [coordinación](../equipo-y-acuerdos.md), [flujo](../flujo-codex.md), [ROUTE-SHEETS-04](ROUTE-SHEETS-04.md), [ROUTE-SHEETS-05](ROUTE-SHEETS-05.md), [ROUTE-SHEETS-06](ROUTE-SHEETS-06.md), [FLEET-06](FLEET-06.md) y [BOOK-02 T2a](BOOK-02-T2a.md). Las reglas vigentes sustituyen formulaciones históricas incompatibles de esas specs; no se reabre lo ya confirmado en D-01/02/03.

## 2. Evidencia actual y dependencias

| Elemento | Estado observado en 1dcbd6d |
|---|---|
| Hoja/asignación/servicio | D-03 persiste identidades y programación, puntos fechados y publicación validada |
| Tarifa | API pública tariffQueries, matrices explícitas en centavos y política congelada por hoja |
| Asientos | Fleet expone seatQueries.listByBus({ busId, cooperativeId }); devuelve todos con seatId, layoutSeatKey, offered y categoría actual NORMAL |
| Versión comercial de inventario | No existe por hoja en ese contrato; no confundir versión de plantilla con inventario ofrecido |
| Viaje | No se encontró tabla/identidad ni tripQueries en el módulo actual |
| Reservas | getSeatAvailability usa TripCatalog.findBookableById(tripId), routePointCount y seatIds; no verifica hora del embarque elegido |
| Ciclos | Hay períodos programados por hoja y máximo de dos no terminados por grupo; relación estable de serie/base/renovación no implementada |
| Ventana antigua | purchase-window sigue calculando 28 días desde hoy; no usarlo como autoridad para D-04 |

Se puede preparar esta spec y avanzar con identidad/lecturas una vez cerrados los contratos pertinentes. La comercialización completa depende de §10, no necesariamente de terminar toda la UI de Fleet o renovación D-05. No se inventan APIs disponibles ni estados de PR a partir de referencias históricas.

## 3. Alcance

Incluye, tras aprobación: persistir viaje por asignación SERVICE, capturar referencias/copia comercial de inventario y recorrido, integrar creación con publicación, exponer consultas públicas internas y validar elegibilidad por embarque. Cada sección funcional incluye pruebas y evidencia.

Fuera: reservas/ocupaciones/expiración, cobros, descuentos finales por pasajero, boletos, búsqueda consolidada con filtros/paginación, pantallas, optimización de rotación, generación/renovación y sustitución D-05, categorías de Fleet aún no implementadas, Wallet y Chofer/Controlador. No se añade un módulo trips separado ni un repositorio simulado de producción.

## 4. Identidad y persistencia propuestas

### 4.1. Un viaje por servicio comercial asignado

- tripId: UUID propio generado en servidor; no reutilizar frequencyId, busId o assignmentId como identidad de viaje.
- Relación estable: tripId → cooperativeId, routeSheetId, assignmentId, requiredServiceId, frequencyId y busId. La asignación debe pertenecer a la hoja/cooperativa publicadas y cubrir exactamente esa salida.
- Un SERVICE genera un viaje; una parada genera posiciones dentro del viaje, no otro viaje. TRANSFER y bloqueos no generan viajes vendibles.
- Unicidad de assignmentId dentro del contexto de hoja/tenant; repetir publicación o materialización no cambia el tripId ni crea un duplicado. Otra fecha/salida tiene otra asignación y otro viaje, aunque repita frecuencia y bus.
- Guardar programación en DRAFT no crea viajes comercializables. No aceptar IDs elegidos por navegador ni construir viajes dinámicos nuevos en cada GET.

Representación prevista mediante **migración nueva**: viajes con referencias compuestas a registros propios de Route Sheets, revisión de programación, referencia de tarifa congelada y referencia al inventario comercial; recorrido fechado por posición e inventario comercial por hoja/bus con identidad/revisión propias. Las columnas/tablas definitivas se concretarán tras §10. No FK ni SQL sobre tablas privadas de Fleet/Bookings.

### 4.2. Publicación y captura comercial

Recomendación Q1: crear identidad, recorrido y copia comercial de asientos ofrecidos al publicar, en la misma unidad transaccional que el estado de hoja y la congelación tarifaria. Fallo de proveedor, datos incompletos o error de persistencia revierte todo. Reintento usa la identidad ya persistida y nunca recaptura asientos desde Fleet para alterar un viaje publicado.

Recomendación Q2: Route Sheets conserva una copia comercial inmutable por hoja/bus, obtenida solo mediante API pública real de Fleet. Incluye IDs y atributos de asientos ofrecidos, orden estable y metadatos/versiones que Fleet garantice. Varios viajes del mismo bus en esa hoja pueden referenciar esa misma copia; la ocupación sigue siendo por viaje/tramo en Bookings. Un asiento con offered:false no se vende. No convertir layoutSeatKey o número visible en seatId.

inventorySnapshotId/revision de Route Sheets identifican **su copia comercial**, no una supuesta revisión de Fleet. schemaVersion solo identifica formato; seatLayoutVersion identifica plantilla y no demuestra que offered/categorías permanezcan iguales. No rellenar una versión de origen inventada ni afirmar atomicidad de una lectura mutable realizada por otro pool.

Alcance inicial confirmado por el solicitante en Q2: la API actual de Fleet solo crea/consulta bus y asientos. Su consulta obtiene bus/posiciones en una sentencia SQL consistente; atributos de identidad, propiedad, plantilla, categoría y offered no tienen operación productiva de edición en el código examinado. Se captura desde esa API pública sin inventar una revisión de origen. Cualquier futura edición requiere acordar antes sesión transaccional pública o lectura de configuración inmutable por versión; el lock de Route Sheets no protege tablas ajenas. No se atribuye una aprobación individual nueva a Edwin.

### 4.3. Hojas ya publicadas

Una hoja histórica sin programación completa o sin copia comercial verificable no se convierte automáticamente en viaje al leerla. Se conserva su historia y el snapshot tarifario conforme a D-03. La tarifa antigua no demuestra qué inventario existía al publicar.

Q3 debe decidir si la primera fase solo materializa publicaciones nuevas o incluye un caso de conciliación explícita de hojas existentes. Una conciliación necesitaría actor, auditoría, procedencia verificable de configuración y comprobación de compromisos existentes mediante APIs públicas. Si ese proveedor falta, no interpretar la ausencia como cero reservas. No ejecutar backfill indiscriminado desde una migración ni reconstruir inventario histórico usando el bus actual sin acuerdo humano.

## 5. Recorrido, elegibilidad y ciclos

Recorrido ordenado con posiciones consecutivas desde cero, locationKey y arrivalAt/departureAt aplicables. Origen admite salida; destino llegada y no embarque; paradas intermedias admiten embarque/desembarque. Instantes ISO con offset; fecha local continental America/Guayaquil, sin inferir cruce de medianoche comparando horas. Reusar la información autorizada/congelada de D-03 y no cambiar posiciones por recorridos actuales de Frecuencias.

Para un par debe cumplirse 0 <= fromPosition < toPosition < routePointCount, existir tarifa explícita de ese par y now < departureAt del punto fromPosition. En igualdad cierra la venta. Si salió el origen y aún no salió una parada posterior, esa parada puede continuar admitiendo compra. No cerrar globalmente todas las paradas al salir del origen.

Además: hoja/ciclo confirmado, viaje realmente vinculado a ese período, frecuencia activa de la cooperativa derivada, bus y copia comercial válidos, tarifa congelada íntegra e inventario ofrecido verificable. Comercializable no significa asiento libre: Bookings consulta ocupaciones RESERVED/SOLD, incluida revisión, y revalida al reservar bajo su control de concurrencia. No descartar fallos técnicos como ausencia de ocupaciones.

Dos ciclos siguen siendo **dos totales, incluida la base**, no base más dos. Borradores no amplían horizonte ni puede confirmarse por inferencia un ciclo posterior a un borrador. No usar hoy+28/hoy+2L, ni crear o renovar ciclos por consultar.

**Q4 confirmado:** persistir el vínculo explícito de serie, hoja base, inicio y duración común, sin inferirlo por fechas ni generar programación. La primera publicación de una nueva base crea la serie en servidor. Para enlazar una hoja siguiente ya programada se envía seriesId al publicar; debe pertenecer al mismo grupo/tenant, continuar exactamente el último fin exclusivo y conservar L días. No crear otra serie mientras exista una vigente en el grupo ni superponer una nueva base al cierre histórico. La numeración preserva historia y puede superar dos solo cuando hay cupo: el límite es dos períodos no terminados, no dos durante toda la vida de la serie. Una publicación manual puede enlazar una hoja existente; no copia, crea o renueva hojas automáticamente. La consulta del horizonte se implementará en sección 2 sobre estas relaciones persistidas.

## 6. API pública interna — Q5 confirmado por David

Funciones implementadas en `routeSheets.tripQueries`; la conexión del consumidor de Leslie queda fuera de esta tarea:

| Función | Semántica confirmada |
|---|---|
| findBookableById(tripId) | null si ausente/no elegible o sin ningún embarque comercializable; de lo contrario snapshot mínimo compatible con TripCatalog y datos comerciales permitidos. No autoriza cualquier posición por sí sola |
| findBookableForSegment({ tripId, fromPosition, toPosition }) | Comprueba el par, plazo de ese embarque y tarifa explícita; devuelve snapshot del par o null si ya no admite compra |

Entrada no admite cooperativeId, busId, seatIds, precio, porcentajes ni reloj elegidos por comprador. La aplicación deriva tenant y relaciones del viaje real; el reloj se inyecta en la composición para pruebas, no desde HTTP. Consulta con ID inválido/posiciones inválidas: error de dominio; inexistente/no comercializable: null; proveedor ausente, copia corrupta o error técnico: error, nunca null o inventario vacío ficticio.

DTO confirmado (tipos):

```text
tripId, cooperativeId, routeSheetId, assignmentId, requiredServiceId,
frequencyId, busId, programmingRevision, tariffRevision,
inventorySnapshotId, inventoryRevision,
routePointCount, routePoints[{position, locationKey, arrivalAt?, departureAt?}],
seatIds[UUID de asientos ofrecidos],
confirmedThroughExclusive
```

La consulta por par agrega fromPosition, toPosition, boardingAt y precio base explícito en centavos/política tarifaria, o referencia verificada a tariffQueries sin duplicar autoridad. Congelación/descuentos continúan según ROUTE-SHEETS-05: VIP primero y mayor beneficio acreditado, sin acumular; D-04 no determina acreditaciones ni total final. No resolver aquí el desempate de etiquetas de beneficios que pertenece a Reservas.

El consumidor actual de Leslie solo valida routePointCount/seatIds y luego consulta ocupaciones. No comprueba el embarque elegido. Q5 propone conservar su firma de entrada pública `{ tripId, fromPosition, toPosition }`, pero acordar un puerto/adaptador que utilice la consulta por par antes de ocupaciones/cotización/reserva. No conectar únicamente findBookableById y presentar la integración como completa. Cambios en Bookings requieren su propia autorización y spec; no modificarlo incidentalmente.

Las consultas públicas internas son de catálogo comercial y pueden resolver un viaje de otra cooperativa según el contrato explícito de búsqueda de solo lectura de RN-02. No habilitan listados administrativos globales ni lecturas de reservas/pasajeros. Los repositorios administrativos siguen filtrando tenant verificado. Q5 debe confirmar qué DTO puede usarse anónimamente, qué queda en lectura interna y si hace falta un GET HTTP en esta entrega. No se fija una ruta pública por inferencia; búsqueda consolidada queda fuera.

## 7. Ejemplos de aceptación

Ejemplos ficticios de una frecuencia con paradas: Ambato salida 02 nov. 23:00; Latacunga llegada 03 nov. 00:15/salida 00:20; Quito llegada 02:00. Tarifa explícita para cada par y copia comercial válidas.

| Situación | Resultado esperado |
|---|---|
| Compra Ambato–Quito el 02 nov. 22:59 | Elegible temporalmente si período/relaciones están confirmados |
| Compra Ambato–Quito a las 23:00 exactas | Cierre de ese embarque |
| Compra Latacunga–Quito el 03 nov. 00:10 | Puede ser elegible aunque salió Ambato |
| Compra Latacunga–Quito a las 00:20 | Cierre de ese embarque |
| fromPosition >= toPosition o embarque en destino | Entrada inválida |
| Frecuencia activa, pero sin viaje persistido/hoja confirmada | No comercializable |
| Segundo ciclo DRAFT o sin vínculo de confirmación verificable | No amplía ventas |
| Asiento offered:false o inventario sin procedencia verificable | No ofrecerlo; no fabricar disponibilidad |
| Repetir publicación | Mismo tripId, recorrido, inventario y referencia tarifaria |
| Cae proveedor de inventario o tarifa | Error; sin publicación parcial ni respuesta gratuita |

Ambato–Latacunga, Latacunga–Quito y Quito–Ambato como **tres frecuencias** asignadas al mismo bus son tres viajes, cada uno con ID propio; las paradas dentro de una única frecuencia siguen siendo posiciones del mismo viaje. No inferir identidad o cobertura de nombres de ciudades.

## 8. Criterios y pruebas previstas

- [ ] Unicidad y estabilidad del viaje por asignación, incluso ante publicación simultánea/reintento.
- [ ] No viajes vendibles de DRAFT/TRANSFER/bloqueos ni generación dinámica en lectura.
- [ ] Transacción revierte estado, tarifa, viajes, puntos e inventario ante fallo intermedio.
- [ ] Snapshot conserva IDs reales/orden/offered y revisiones; no depende del bus actual para reescribir historia.
- [ ] Consulta por par valida puntos, medianoche, igualdad de cierre, tarifa y período confirmado real.
- [ ] Cambios de fuentes, ausencia y fallos se distinguen sin aceptar compras por defecto.
- [ ] Relaciones administrativas filtran tenant y catálogo expone solo datos expresamente autorizados, sin pasajeros ni comprobantes.
- [ ] Consumidor de Leslie tiene contrato compatible por embarque antes de declarar integración productiva.
- [ ] Hojas históricas no se convierten automáticamente en viajes ni pierden sus snapshots previos.

Unitarias de identidad, proyección, elegibilidad y reloj; integración PostgreSQL aislado para unicidad, relaciones compuestas, captura atómica, rollback, concurrencia y snapshots; pruebas de contrato con proveedores reales y arranque si cambia composición. Dobles exclusivamente en unitarias. Validar con [testing-database.md](../testing-database.md), sin leer .env; ejecutar lint, format:check y npm test por sección funcional y reportar resultados reales. Adaptar preparación de pruebas históricas solo con autorización cuando corresponda, sin omitirlas ni debilitar sus comprobaciones.

## 9. Tres secciones, un commit por sección

| Sección | Resultado / dependencia | Commit sugerido |
|---|---|---|
| 0 | Esta spec, propuestas y seguimiento, sin producto | docs(hojas-ruta): define el contrato de viajes comercializables |
| 1 | Tras acuerdos pertinentes y autorización: identidad/persistencia y captura comercial en publicación, migración nueva y pruebas | feat(hojas-ruta): persiste los viajes de las hojas publicadas |
| 2 | Tras acuerdos de consulta y autorización: API pública y elegibilidad por embarque, composición/pruebas reales | feat(hojas-ruta): consulta viajes y valida su comercialización |

Un commit lógico incluye código, pruebas y evidencia de su sección. Implementar no autoriza ejecutar commit/push/merge. La sección 0 no acredita que el contrato de Fleet/Bookings ya exista. No ampliar automáticamente a D-05 para suplir una decisión pendiente de series.

## 10. Acuerdos y registro histórico de alternativas

El 2 de noviembre el solicitante confirmó las recomendaciones de publicación nueva/atómica y copia comercial bajo la inmutabilidad actual de Fleet, y eligió «Vínculo explícito de serie y ciclos, sin renovación automática». Quedan confirmados Q1–Q4 en ese alcance por David; no son respuestas individuales de Leslie o Edwin ni revisión humana del código. La tabla conserva alternativas/recomendaciones históricas. Posteriormente David confirmó Q5 como consta en sección 14: API interna, sin GET ni cambios en Bookings.

| ID / participantes | Pregunta concreta y alternativas | Recomendación / impacto |
|---|---|---|
| Q1: David, Leslie | ¿Crear viaje estable y recorrido al publicar o en un proceso posterior? | Al publicar y atómicamente con tarifa/estado; requiere reintentos idempotentes y preparación de pruebas anteriores. |
| Q2: David, Edwin, Leslie | ¿Quién conserva la copia comercial/versionada de asientos y cómo garantiza su captura consistente? | Route Sheets conserva copia por hoja/bus, Fleet conserva fuente y ofrece contrato público consistente o evidencia explícita de inmutabilidad. Acordar campos/revisión y momento de captura antes de código. No exige implementar toda la UI VIP. |
| Q3: David, Leslie | ¿La primera fase incorpora hojas ya publicadas sin inventario congelado? | Comenzar con publicaciones nuevas y mantener las anteriores como historia no vendible por esta API. Conciliación explícita posterior, con procedencia/auditoría y proveedor real de compromisos; no backfill implícito. Confirmar alcance. |
| Q4: David, Leslie | ¿Vínculo mínimo de serie para dos ciclos confirmados o primera fase limitada a un ciclo base identificado? | Identidad/vínculo explícitos mínimos en D-04, sin generación/renovación. Si se limita a uno, documentar que el segundo no amplía horizonte hasta la continuación. No derivar serie por orden de fechas. |
| Q5: David, Leslie | ¿Aceptar las dos consultas propuestas y adaptar el consumidor para comprobar el embarque seleccionado? ¿Lectura interna o también GET público? | Consulta por par antes de disponibilidad/cotización/reserva, conservando entrada del usuario sin tenant/inventario/precios. Confirmar DTO y responsabilidades de adaptación; no atribuir implementación a Leslie por una propuesta. |

Registro requerido para cada respuesta: persona, fecha, decisión y límites, conforme al protocolo de equipo. El mensaje previo de Leslie solicita cerrar el contrato; no constituye aprobación de estas firmas nuevas. El silencio no es aceptación. Trabajo independiente permitido: revisar contratos/datos existentes; secciones dependientes sin implementar hasta resolver lo que las afecta.

## 11. Calidad, seguridad y revisión

Domain valida identidad/recorrido/elegibilidad con reloj explícito; application coordina puertos públicos; infrastructure implementa transacción/consultas de su módulo; interfaces traduce HTTP solo si se acuerda ese alcance. Reusar tarifa y validadores de D-01/D-03; no importar capas privadas ni duplicar precios/descuentos en Viajes.

Sin frontend en esta tarea: no aplica DESIGN.md ni se declara usabilidad visual comprobada. Contrato debe distinguir datos ausentes, embarque cerrado y fallo técnico sin filtrar información ajena; futura pantalla muestra fecha/hora de la parada elegida. El nombre comercializable no debe inducir al cliente a creer que el asiento ya está reservado.

No aplica defecto inducido. Respetar [protocolo](../errores-inducidos.md); errores de identidad, inventario, concurrencia u horizonte no son defectos académicos autorizados. Cierre requiere revisión humana, evidencia de integración y comprobación posterior; no marcar Integrada/Cerrada por terminar esta spec.

## 12. Evidencia de sección 0

Consultados programación/publicación/tarifa, API pública de Fleet, consumidor y puertos actuales de Bookings, reglas/specs y guía del proyecto. ROUTE-SHEETS-07 no estaba en las specs examinadas. Rama válida y árbol inicialmente limpio en 1dcbd6d. No se certifica ausencia de trabajo privado/remoto posterior ni se enviaron mensajes a otros integrantes.

Cambios solo Markdown: esta spec, seguimiento y referencia desde D-03. Sin algoritmo, endpoints, migraciones, dependencias, pruebas ejecutables, commits ni publicación. No se ejecutan lint/Jest por esta sección documental; la evidencia previa de 1458 pruebas pertenece a D-03, no valida D-04. Diff documental revisado y git diff --check aprobado; 86 enlaces locales comprobados sin destinos inexistentes (sin certificar anclas/externos). Próximo paso: responder Q1–Q5 y confirmar el contrato técnico de Q2 con Edwin; luego autorizar sección 1.

## 13. Sección 1 — captura comercial al publicar

La sección 12 conserva evidencia histórica. Base local 4e5c8df, rama feature/ROUTE-SHEETS-07-viajes-comercializables inicialmente limpia. El solicitante autorizó sección 1 y resolvió Q1–Q4 como consta arriba. No se refrescó remoto ni se certifica trabajo privado de otros integrantes. No hay aprobación de PR nueva.

### Comportamiento implementado

El POST existente `/:id/publish` admite seriesId opcional, además de las dos revisiones existentes. Si falta al publicar una base nueva, el servidor crea serie/ciclo 1; si existe una serie vigente del grupo se exige su ID explícito para continuar. UUID inválido: COMMERCIAL_TRIP_INVALID/400; serie desconocida, de otro tenant/grupo, fecha no consecutiva, distinta duración o falta de cupo: COMMERCIAL_SERIES_CONFLICT/409. No se deduce serie por ordenar hojas. Los períodos y límite de borradores de D-03 siguen siendo autoridad previa de agenda; el enlace no genera hojas ni elude esos límites.

La respuesta conserva `{ routeSheet }` y añade dentro de routeSheet `commercial: { seriesId, cycleId, cycleNumber, tripIds }`. Así el administrador obtiene el identificador necesario para vincular la siguiente hoja ya programada. En reintento se devuelve el mismo manifiesto, actor/fecha y copia; no se consulta Fleet ni se generan UUID nuevos. Si se envía seriesId distinto del original, se rechaza. Hoja publicada histórica sin manifiesto devuelve commercial:null y mantiene su copia tarifaria; no reconstruye viajes ni asientos actuales.

La sesión transaccional de publicación, bajo el lock de ADR 0006, revalida programación/tarifa y captura inventario real mediante seatQueries.listByBus. Copia solo offered:true, con seatId, layoutSeatKey, label, deck, row, column y category reales, respetando orden del proveedor. Datos inválidos/duplicados o fallo técnico: COMMERCIAL_TRIP_SOURCE_UNAVAILABLE/503; inventario ausente/vacío: conflicto 409. Categoría NORMAL/VIP se conserva si la fuente la proporciona; no se implementa por ello edición VIP/accesibilidad en Fleet, ni se inventa accesibilidad o revisión de configuración. Las versiones schemaVersion=1 y revision=1 pertenecen a la copia nueva e inmutable de Route Sheets, no a Fleet.

Cada SERVICE genera un tripId UUID de servidor distinto de la identidad de frecuencia/asignación. Varios servicios del mismo bus/hoja comparten un inventario comercial; otro ciclo tiene otra copia, manteniendo los IDs reales de asiento. TRANSFER y bloqueos no generan viajes. Recorrido, posiciones y fechas se copian de la programación validada; tarifa se referencia por hoja/revisión congelada, sin recalcular ni sumar tramos.

Se insertan serie/ciclo, inventarios, viajes y auditoría antes del freeze tarifario/estado, con el mismo cliente/transacción. Un fallo revierte todos los registros, incluida una serie recién creada. Solo el commit conjunto hace visible la publicación. Series y número de ciclo permanecen estables; no existe tarea periódica, copia automática de patrón ni sustitución D-05.

### Persistencia y fronteras

Migración nueva `1793730000000-commercial-trips.js`: route_sheet_commercial_series, route_sheet_commercial_cycles, route_sheet_commercial_inventories y route_sheet_trips. Referencias compuestas a tablas propias evitan mezclar hoja/tenant/asignación/servicio/ciclo/inventario. Unicidad por asignación, hoja/ciclo, serie/número e inventario hoja/bus. Ningún FK ni SQL sobre tablas privadas de Fleet/Bookings. UUID generados con gen_random_uuid en servidor; timestamps de captura/auditoría proceden de la transacción.

Triggers rechazan UPDATE/DELETE de los registros comerciales; reintentar no los actualiza. Down rechaza información comercial persistida, sin destruir historia para restaurar el esquema. No se editan migraciones históricas. Los datos comerciales se insertan únicamente desde publicación normal en este incremento; los catálogos de lectura de sección 2 deberán exigir estado publicado, integridad y elegibilidad, no tratar filas aisladas como autorización de venta.

Application recibe puertos y prepara datos; domain valida inventario/serie; infrastructure persiste y controla commit. [Contratos internos](../../backend/src/modules/route-sheets/domain/ports/commercial-publication-ports.md). server.js inyecta la API pública real de asientos de Fleet. No se añade un módulo trips independiente ni se importan capas ajenas. El código de Bookings, sus firmas y consultas por embarque permanecen intactos; no hay tripQueries público en sección 1.

### Verificación y límites

53 pruebas nuevas aprobadas: 34 unitarias y 19 integraciones con arranque real de server.js, sesiones/CSRF, Fleet/Frecuencias reales y PostgreSQL aislado. Incluyen identidad estable, solo ofrecidos, copia por bus/ciclo, dos buses con traslados sin viajes extra, continuación explícita, rechazo de series ajenas/no consecutivas, reintentos simultáneos, inmutabilidad SQL, referencias compuestas, error de fuente, rollback tras insertar viajes, historia sin backfill y down protegido. Pruebas unitarias de política permiten historia terminada sin consumir cupo ni renumerarla; no ejecutan renovación automática.

Se adaptó únicamente preparación autorizada de pruebas anteriores: puerto de asientos/sesión comercial en dobles unitarios; proveedor real en integración; cuatro listas TRUNCATE incorporan las cuatro tablas nuevas. La prueba de reversión de programación retira temporalmente la migración posterior vacía para seguir comprobando que su migración original rechaza pérdida de datos y restaura el esquema; comprobaciones y límites conservados. Los fixtures alteran offered/estado directamente solo para probar independencia de fuentes en la base aislada, sin habilitar una operación de edición productiva.

**Verificación final:** npm test aprobado con **1267 unitarias + 366 integraciones = 1633 pruebas**, 70 suites unitarias y 28 de integración aprobadas. Incluye las 53 nuevas (34 unitarias/19 integraciones); las pruebas existentes de publicación, programación y tarifa mantienen sus comprobaciones y aprueban. Arranque real de server.js y uso de APIs públicas reales de Fleet/Frecuencias verificados. Sin pruebas omitidas ni fallos inducidos.

Lint y formato de todos los JS cambiados/nuevos aprobados; format:check global conserva 41 archivos previos pendientes, incluidas cuatro migraciones históricas intactas. Diff completo revisado, git diff --check aprobado y 74 enlaces locales comprobados sin destinos inexistentes (sin certificar anclas/externos). Sin dependencias nuevas ni .env leído. Node local 22.19.0; sigue pendiente verificar el runtime 24 requerido, sin repetir la acción rechazada documentada en D-03. PostgreSQL efímero busesuta-trips-s1 con --env-file NUL y credenciales ficticias versionadas; contenedor y red retirados al terminar.

Pendientes propios de esta tarea: Q5 y sección 2 (consultas comerciales/elegibilidad por embarque), no autorizar compra por disponer solo de un tripId. La conciliación de hojas históricas y la recuperación de borradores creados con una fecha incompatible necesitan tarea/alcance explícito; este incremento no añade edición de fecha ni eliminación de borradores. No se implementan reservas, búsqueda consolidada, pantallas, cobros o defectos inducidos.

Mensaje sugerido: `feat(hojas-ruta): persiste los viajes de las hojas publicadas`. Sin commit, PR, revisión humana ni integración nueva ejecutados por el asistente.

## 14. Sección 2 — consulta comercial por embarque

Base local 2e3cdca en feature/ROUTE-SHEETS-07-viajes-comercializables, árbol inicialmente limpio. David confirmó Q5 y su alcance el 2 de noviembre de 2026: `tripQueries.findBookableById(tripId)` y `tripQueries.findBookableForSegment({ tripId, fromPosition, toPosition })`, DTO de sección 6, únicamente API interna. Las menciones anteriores a Q5 pendiente conservan contexto histórico; esta confirmación las resuelve sin atribuir aceptación individual a Leslie.

La composición exporta ambas funciones. El UUID estable resuelve el catálogo comercial autorizado; todas las consultas posteriores de tablas propias filtran por la cooperativa derivada del viaje. No se aceptan tenant, bus, asientos, precios ni reloj del consumidor. El repositorio obtiene las relaciones, copias y serie en una transacción REPEATABLE READ READ ONLY, con rollback/liberación ante errores. Libera esa conexión antes de consultar APIs públicas de Fleet/Frecuencias para evitar agotar el pool con consultas paralelas. No consulta tablas privadas de otros módulos.

Domain comprueba identidades, revisiones, ciclo consecutivo y pertenencia, recorrido fechado/ordenado, inventario ofrecido y matriz tarifaria completa. La respuesta congela objeto, recorrido, asientos y política, sin mutar fuentes. La consulta por par agrega `fromPosition`, `toPosition`, `boardingAt`, `currency: 'USD'`, `amountCents` y `policy`; el precio es la combinación explícita, nunca suma de tramos. Los porcentajes son puntos básicos enteros de la política congelada de D-02; no se calcula acreditación ni total final aquí.

El reloj se toma después de consultar las fuentes actuales. La igualdad con la salida del embarque cierra ese par; haber salido del origen no cierra paradas posteriores, incluso al cruzar medianoche. La consulta general exige que quede algún embarque futuro y no autoriza por sí sola cualquier par. El horizonte se calcula exclusivamente con ciclos publicados de la serie persistida, conserva su referencia base y no se amplía por un borrador ni por hoy+2L. No se generan ciclos al leer.

Ausencia del viaje, borrador, ausencia normal de frecuencia/bus, frecuencia inactiva, bus de otro grupo o embarque cerrado devuelven null. Puerto ausente, fuente malformada, copia inconsistente o reloj inválido generan error; errores técnicos de proveedores se propagan, sin convertirlos en ausencia. La ausencia normal de una entidad es distinta de carecer del proveedor de consulta. Los asientos y precios provienen siempre de copias congeladas; comprobar existencia/grupo del bus o estado actual de la frecuencia no reescribe esas copias.

Esta lectura observa fuentes actuales sin bloquearlas junto a Reservas. No garantiza asiento libre ni reserva: Bookings debe conectar la consulta por par, comprobar ocupaciones RESERVED/SOLD y revalidar bajo su concurrencia. No se modifica Bookings, no hay GET público ni búsqueda consolidada, frontend, renovación automática, Wallet o Chofer. Sin nuevas migraciones/dependencias ni cambios a pruebas anteriores en esta sección.

### Verificación de sección 2

Comprobación final del código definitivo: **36 pruebas nuevas aprobadas (30 unitarias y 6 integraciones)**. Cubren precio independiente de tramos, política/inventario congelados, inmutabilidad del DTO, medianoche y cierre exacto, entradas ajenas al contrato, corrupción, ausencia y errores técnicos, reloj tras proveedores, arranque real, ausencia de GET, continuación explícita de serie, borradores sin ampliar horizonte, rollback/liberación de conexión y doce consultas paralelas con proveedores reales. Dos errores iniciales de preparación de la suite nueva (puerto opcional de Bookings y nombre de tabla de asientos) se corrigieron conservando sus comprobaciones.

`npm test`: **1297 unitarias aprobadas; 370 integraciones aprobadas y una fallida** por timeout de 20 segundos en `fleet/bus-photo-storage.test.js`, caso «prepara y promueve todos los bytes sin conservar nombres ni rutas del cliente». Repetición aislada: 17 aprobadas y el mismo caso fallido. No se modifica esa prueba, su límite ni Fleet; la suite global no se declara verde. La comprobación final dirigida incorpora además el sexto caso nuevo de concurrencia, añadido después de iniciar la global; por eso no se suman estos conteos como una sola ejecución global.

Lint aprobado; formato de todos los JS nuevos/cambiados aprobado; `format:check` global mantiene los 41 archivos previos pendientes, incluidas cuatro migraciones históricas intactas. Diff revisado y `git diff --check` aprobado. Sin `.env` leído. PostgreSQL aislado con credenciales ficticias versionadas, proyecto busesuta-trips-s2, retirado al terminar. Node local 22.19.0; sigue pendiente verificar Node 24. No constituye aprobación humana ni integración remota; no se ejecutan commit, push ni merge.

Commit sugerido: `feat(hojas-ruta): consulta viajes y valida su comercialización`.

## 15. Respuesta de Leslie y continuación de renovación — 3 de noviembre de 2026

Fuente: mensaje de Leslie aportado por David al autorizar la sección 0 de [ROUTE-SHEETS-08](ROUTE-SHEETS-08.md). Leslie acepta la propuesta `findBookableForSegment({ tripId, fromPosition, toPosition })`, condicionando adaptar su consumidor a concretar respuesta y errores: identidad del viaje, tenant, hoja/asignación, bus, embarque fechado, referencia de inventario, tarifa explícita en centavos y política congelada con revisión. Pide revalidar esos datos al reservar bajo protección de concurrencia. Esta respuesta no acredita adaptación ni composición de Bookings ni aceptación humana del código existente.

La implementación de §6/14 ya aporta esos datos en el DTO por par, con `tariffRevision` y `policy`; errores de dominio/fuente y null se mantienen según §6. Falta acordar la correspondencia exacta con el puerto consumidor y su protocolo de revalidación antes de conectarlo. No se modifica esa API en esta sección documental. [BOOK-02/L-02](BOOK-02-L02.md) conserva la contraparte; no reabrir las reglas ya acordadas de embarque/ciclos ni presentar esta nota como una integración ejecutada.

Leslie permite preparar renovación conservando viajes/reservas anteriores. ROUTE-SHEETS-08 sección 0 concreta esa planificación y registra también los contratos de ocupaciones/sustitución todavía propuestos. Una renovación crea un destino nuevo; la sustitución y su coordinación concurrente se especificarán aparte, sin mutar copias publicadas ni recalcular compras antiguas por inferencia.
