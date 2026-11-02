# ROUTE-SHEETS-07: Viajes comercializables con identidad estable

- **Referencia de planificación:** D-04; referencia local, sin ticket externo.
- **Responsable:** David, por actividad seleccionada por el solicitante.
- **Estado:** Borrador; sección 0 documental preparada. Secciones 1 y 2 sin autorización de implementación.
- **Fecha:** 2 de noviembre de 2026, America/Guayaquil.
- **Rama / base comprobada:** feature/ROUTE-SHEETS-07-viajes-comercializables, 1dcbd6d; inicialmente limpia. La base contiene integración de D-03 mediante PR #48. No se refrescó remoto en esta sección; en la revisión anterior origin/develop se comprobó en ese mismo commit.
- **Revisora propuesta:** Leslie; aceptación de revisar esta tarea pendiente. Edwin participa en el contrato de inventario. No se atribuyen aprobaciones individuales nuevas.
- **Autorización:** el solicitante pidió únicamente sección 0. Las propuestas de §10 no equivalen a respuestas humanas ni permiten implementar contratos pendientes.

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

Con Edwin debe precisarse si la captura usa una sesión transaccional pública compatible con ADR 0005/0006 o una revisión de configuración inmutable consultable por versión. La API actual no ofrece esos contratos. Si los atributos son inmutables en producción durante esta fase, documentar exactamente cuáles y qué operaciones futuras invalidarían esa garantía antes de depender de ella.

### 4.3. Hojas ya publicadas

Una hoja histórica sin programación completa o sin copia comercial verificable no se convierte automáticamente en viaje al leerla. Se conserva su historia y el snapshot tarifario conforme a D-03. La tarifa antigua no demuestra qué inventario existía al publicar.

Q3 debe decidir si la primera fase solo materializa publicaciones nuevas o incluye un caso de conciliación explícita de hojas existentes. Una conciliación necesitaría actor, auditoría, procedencia verificable de configuración y comprobación de compromisos existentes mediante APIs públicas. Si ese proveedor falta, no interpretar la ausencia como cero reservas. No ejecutar backfill indiscriminado desde una migración ni reconstruir inventario histórico usando el bus actual sin acuerdo humano.

## 5. Recorrido, elegibilidad y ciclos

Recorrido ordenado con posiciones consecutivas desde cero, locationKey y arrivalAt/departureAt aplicables. Origen admite salida; destino llegada y no embarque; paradas intermedias admiten embarque/desembarque. Instantes ISO con offset; fecha local continental America/Guayaquil, sin inferir cruce de medianoche comparando horas. Reusar la información autorizada/congelada de D-03 y no cambiar posiciones por recorridos actuales de Frecuencias.

Para un par debe cumplirse 0 <= fromPosition < toPosition < routePointCount, existir tarifa explícita de ese par y now < departureAt del punto fromPosition. En igualdad cierra la venta. Si salió el origen y aún no salió una parada posterior, esa parada puede continuar admitiendo compra. No cerrar globalmente todas las paradas al salir del origen.

Además: hoja/ciclo confirmado, viaje realmente vinculado a ese período, frecuencia activa de la cooperativa derivada, bus y copia comercial válidos, tarifa congelada íntegra e inventario ofrecido verificable. Comercializable no significa asiento libre: Bookings consulta ocupaciones RESERVED/SOLD, incluida revisión, y revalida al reservar bajo su control de concurrencia. No descartar fallos técnicos como ausencia de ocupaciones.

Dos ciclos siguen siendo **dos totales, incluida la base**, no base más dos. Borradores no amplían horizonte ni puede confirmarse por inferencia un ciclo posterior a un borrador. No usar hoy+28/hoy+2L, ni crear o renovar ciclos por consultar.

**Pendiente Q4:** D-03 no guarda identidad de serie/relación entre sus hojas-ciclo. Por ello no basta ordenar dos hojas y llamarles C1/C2. Se recomienda introducir el vínculo mínimo explícito de serie, inicio base y duración común necesario para acreditar períodos consecutivos confirmados, sin implementar generación/renovación D-05. Alternativa: limitar la entrega inicial a un ciclo base explícitamente identificado y postergar ampliación al segundo. Elegir una antes de implementar horizonte; nunca anunciar una ventana acumulada sin relación persistida verificable.

## 6. APIs públicas propuestas — pendientes de Leslie

Nombres de `routeSheets.tripQueries`, aún no implementados:

| Función | Semántica propuesta |
|---|---|
| findBookableById(tripId) | null si ausente/no elegible o sin ningún embarque comercializable; de lo contrario snapshot mínimo compatible con TripCatalog y datos comerciales permitidos. No autoriza cualquier posición por sí sola |
| findBookableForSegment({ tripId, fromPosition, toPosition }) | Comprueba el par, plazo de ese embarque y tarifa explícita; devuelve snapshot del par o null si ya no admite compra |

Entrada no admite cooperativeId, busId, seatIds, precio, porcentajes ni reloj elegidos por comprador. La aplicación deriva tenant y relaciones del viaje real; el reloj se inyecta en la composición para pruebas, no desde HTTP. Consulta con ID inválido/posiciones inválidas: error de dominio; inexistente/no comercializable: null; proveedor ausente, copia corrupta o error técnico: error, nunca null o inventario vacío ficticio.

Propuesta de DTO (tipos, no respuesta real ni API confirmada):

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

## 10. Acuerdos pendientes

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
