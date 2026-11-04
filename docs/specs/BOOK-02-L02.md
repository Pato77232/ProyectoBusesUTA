# BOOK-02 / L-02: disponibilidad con fuentes reales

- **Planificación:** L-02; no es una spec aprobada ni un ID externo.
- **Spec existente:** [BOOK-02](BOOK-02.md).
- **Responsable:** Leslie Coello.
- **Revisor propuesto:** Pablo, conforme a la preferencia previa de Leslie; aceptación de este incremento pendiente. Coordinar contratos con los responsables indicados.
- **Estado:** incremento de disponibilidad por tramo seleccionado y autorizado por la petición actual de Leslie de continuar tras PR #65; revisión humana del resultado pendiente. Los demás incrementos conservan sus pendientes.
- **Base histórica (base actual en §15):** rama `feature/BOOK-03-resumen-creacion-dominio`, `c7ceed9`; remoto `origin/develop b60201e`, consultado el 1 de noviembre de 2026, sin integrar.
- **Autorización:** el usuario pidió preparar specs antes de implementar; no se infiere aprobación de este borrador.
- **Referencias:** [plan y evidencia](../reservas-plan-primera-entrega.md), [acuerdos vigentes](https://github.com/Pato77232/ProyectoBusesUTA/blob/b60201e/docs/acuerdos-primera-entrega.md), arquitectura y calidad del proyecto.

## 1. Objetivo

Continuar BOOK-02/T2a conectando el viaje fechado e inventario reales al cálculo existente, sin rehacer la política de solapamiento.

## 2. Reglas

RN-02/12/40. RESERVED y SOLD efectivos bloquean tramos superpuestos, incluida revisión del comprobante. Intervalos adyacentes reutilizan asiento.

## 3. Alcance

Contrato de catálogo, adaptador real y composición comprobada en incrementos separados. API y pantalla locales son evidencia previa; no activarlas como disponibilidad real antes de disponer del catálogo.

## 4. Flujo

Validar entrada → consultar catálogo público → validar identidad exacta del viaje, recorrido ordenado y posiciones → derivar cooperativa/asientos → consultar ocupaciones → calcular estados. Un fallo de proveedor se propaga; jamás significa inventario libre.

## 5. Datos y dependencias

Reutilizar [T2a](BOOK-02-T2a.md) y availability-ports.md. Ampliación de snapshot propuesta: identidad estable de viaje, hoja/asignación/bus/cooperativa, revisión de recorrido/inventario y condiciones de venta. David debe definir el contrato comercializable; route-sheets en develop devuelve router, no esa consulta. Fleet ya expone busQueries y seatLayoutQueries; su existencia no garantiza el snapshot histórico por hoja ni VIP/accesibilidad.

No admitir frecuencia como identidad sustituta del viaje; no aceptar cooperativeId, seatIds ni allocations del navegador. No consulta SQL de tablas ajenas.

## 6. Endpoints

GET /api/v1/bookings/availability ya existe localmente. No añadir otro endpoint ni presentarlo como productivo hasta conectar el proveedor y verificar servidor real. Mantener contrato de privacidad y errores.

## 7. Criterios de aceptación pendientes

- [ ] Viaje devuelto con otra identidad o recorrido/posición inválida se rechaza antes de leer ocupaciones.
- [ ] Asientos y cooperativa proceden del catálogo real.
- [ ] RESERVED/SOLD y revisión bloquean; adyacencia permite reutilización.
- [ ] Error/timeout del catálogo o lector produce error, nunca lista libre.
- [ ] Consulta sin datos personales y sin escrituras/expiración implícita.

## 8. Casos borde

Viaje no publicado o fuera de ventana conforme a reglas acordadas, asiento no ofrecido, inventario vacío, duplicados, recorrido cambiado, fallo técnico y mezcla de cooperativas. No decidir todavía límites comerciales inclusivos ni espacios accesibles como asientos normales.

## 9. Pruebas previstas

Conservar las 53 pruebas históricas T2a. Añadir contrato contra APIs reales y PostgreSQL: identidad/posiciones antes de lector, paradas repetidas identificadas por posición, adyacencia, superposición parcial, SOLD, revisión, fallo de cada proveedor y privacidad. Fixtures identificadas no acreditan la composición real.

## 10. Decisiones necesarias

David/Edwin/Leslie: identidad del viaje, recorrido/versionado, asientos ofrecidos, momento de congelación y regla de comercialización. Recomendación: puerto pequeño de lectura desde API pública de route-sheets, no nuevo módulo trips ni repositorio prestado. La firma interna findBookableById no obliga al proveedor a usar ese nombre. No interpretar la integración PR #33 como catálogo de viajes terminado.

## 11. Defecto inducido

No aplica. No introducir ni corregir incidentalmente defectos académicos; seguir errores-inducidos.md.

## 12. Diseño y usabilidad

Mantener get-seat-availability.use-case.js y puertos propios; adaptador en infraestructura y composición en index.js/server.js. Sin interfaz nueva hasta incremento 3; cualquier pantalla posterior se rige por L-06/DESIGN.md.

## 13. Incrementos y archivos previstos

1. Precisar availability-ports.md y contrato de proveedor; resultado: DTO y errores acordados.
2. Adaptador real y pruebas de contrato; reutilizar domain/availability-request.js y seat-availability.js.
3. Componer en bookings/index.js/server.js, verificar arranque, HTTP y luego selección visual de L-06.

Cada incremento necesita autorización y dependencias satisfechas. Lint, format:check, npm test desde backend con PostgreSQL aislado; arranque real al componer. No dependencias nuevas previstas.
## 14. Revisión y cierre

Revisión humana, autorización de incremento e integración pendientes. Ningún criterio futuro se marca aprobado por la existencia de este borrador. Evidencia documental de esta sesión en el plan; resultados de producto pendientes.


## Actualización de contrato — respuesta de David, 2 de noviembre de 2026

Fuente: respuesta de David transmitida por Leslie en este chat. David confirma viaje con identidad estable propia y propone routeSheets.tripQueries.findBookableById(tripId); sigue sin implementar. No sustituir tripId por frequencyId.

Condiciones comunicadas como acordadas por David: hoja/ciclo confirmado y publicado, frecuencia activa, bus asignado, máximo dos ciclos totales incluida la base, cierre de compra en el instante de embarque del punto seleccionado y disponibilidad por tramo a cargo de Bookings. Las condiciones no acreditan consulta productiva ya disponible.

Recorrido propuesto: puntos ordenados con posición, lugar y fechas/horas completas de llegada/salida donde correspondan; medianoche con fecha explícita. Búsqueda/cierre referidos al punto elegido. Falta cerrar DTO completo y errores.

Aspecto que debe resolverse antes de componer: findBookableById(tripId) no recibe posición ni tramo. Si admite venta en una parada después de salir del origen, la consulta no puede rechazar globalmente el viaje por la hora del origen. Propuesta: devolver condiciones/horarios por punto y validar el embarque elegido, o aceptar contexto de embarque en la consulta pública. Acordar con David; no cambiar una firma unilateralmente.

Inventario histórico asociado a hoja sigue pendiente con Edwin; busQueries no lo sustituye. Tarifario sí comprobado integrado en origin/develop 1fb0ade, PR #39: ver [actualización L-01](BOOK-05-L01.md). Leer precio publicado no equivale a validar identidad comercial de viaje ni asiento.

No se cambia el comportamiento de get-seat-availability ni se registra un adaptador ficticio. Pendientes contrato completo, proveedor real y evidencia de integración.

### Inventario FLEET-06 recibido — 2 de noviembre de 2026

Fuente: respuesta de Edwin reenviada por Leslie. Verificación independiente: commit 7d6353a incluido en origin/develop 7c150c7; rama publicada actualmente en 40adba1. PR #41 consultada; registrar estado remoto comprobado, no el «sin PR» del mensaje anterior.

API comprobada: fleet.seatQueries.listByBus({ busId, cooperativeId }), ambos UUID de contexto confiable, sin campos extra. Respuesta inmutable { busId, seats }; cada asiento incluye seatId UUID propio del bus, layoutSeatKey repetible entre buses, label, deck, row, column, category y offered. Orden: piso descendente y número de asiento. Hoy category solo NORMAL.

Adaptación propuesta para L-02: verificar busId de respuesta contra bus del viaje; validar DTO y unicidad de seatId; conservar orden y usar solo offered === true como inventario reservable. Guardar seatId, nunca layoutSeatKey como identidad. Offered false no significa RESERVED; Fleet no calcula ocupación. Un bus existente sin posiciones ofrecidas devuelve inventario sin oferta, no viaje inexistente ni asientos libres por sustitución.

Bus ausente o ajeno devuelve null; entrada inválida genera VALIDATION_ERROR antes de base; fallos técnicos se propagan. No convertir excepción en null o lista vacía. La cooperativa y el bus deben resolverse desde el viaje confiable.

Evaluación técnica: contrato suficiente para preparar un adaptador acotado de asientos NORMAL, pero no resuelve identidad/recorrido comercial del viaje ni configuración histórica por hoja. La estabilidad actual de seatId y ausencia de edición del bus no constituyen versionado por hoja. No se interpreta ningún asiento como VIP/accesible. Confirmación del contrato por Leslie, autorización del incremento y relación de programación siguen pendientes; esta nota no las inventa.

Pruebas previstas adicionales: dos buses con igual plantilla/clave y distintos seatId; offered false excluido sin confundir con ocupado; bus/tenant incorrectos, error del proveedor propagado y validación previa a ocupaciones. Se leyó código público, caso de uso, validador y SQL del proveedor; no se repitieron sus pruebas ni se integra código remoto en la rama de Leslie.

## Respuesta de Leslie transmitida por David — 3 de noviembre de 2026

David aportó la respuesta de Leslie al solicitar la sección 0 de [ROUTE-SHEETS-08](ROUTE-SHEETS-08.md): acepta la firma propuesta `findBookableForSegment({ tripId, fromPosition, toPosition })` y pide concretar DTO/errores y revalidación al crear la reserva bajo protección de concurrencia. Solicita identidad de viaje, cooperativa, hoja/asignación, bus, embarque fechado, referencia de inventario, tarifa explícita en centavos y política congelada con revisión.

La consulta por par y su DTO ya están implementados en [ROUTE-SHEETS-07 §6/14](ROUTE-SHEETS-07.md); las menciones anteriores a proveedor sin implementar son antecedentes históricos. La correspondencia con el puerto de Bookings y el protocolo de revalidación siguen pendientes de concretar y autorizar antes de adaptar el consumidor. No se afirma conexión productiva, pruebas nuevas ni autorización de implementación en Bookings por este registro. Renovación conserva las reservas anteriores; sustitución requiere otro contrato.


## 15. Incremento seleccionado: disponibilidad con viajes publicados

Base 65957a9, PR #65 integrada (2026-11-04T01:58:43Z); rama feature/BOOK-02-disponibilidad-viajes-reales. Leslie solicita verificar integración y continuar el siguiente paso: se concreta únicamente disponibilidad real. No se atribuye aprobación colectiva ni se cierran L-01/L-03/L-05/L-06.

Inspección actual: ROUTE-SHEETS-07 ya expone tripQueries.findBookableForSegment({ tripId, fromPosition, toPosition }) en createRouteSheetsModule; valida publicación, ciclo/embarque, frecuencia/bus, recorrido, tarifa y copia de inventario por hoja. No rehacer el catálogo ni consultar asientos actuales de Fleet como sustituto de la copia. La firma propuesta por David coincide con este código. PR accesibles por disponibilidad: #15 es la entrega histórica, sin este proveedor; no se identificó una integración posterior equivalente.

### Alcance y contratos

- Mantener GET /api/v1/bookings/availability y su protección CUSTOMER/no-store; no abrir acceso anónimo/invitado ni añadir pantallas.
- Inyectar tripQueries por la API pública de Route Sheets solo para disponibilidad. Un adaptador de Bookings llama siempre findBookableForSegment con la entrada validada. Si falla, no intenta findBookableById como alternativa.
- Antes de consultar ocupaciones: validar identidad exacta de viaje/par, UUID de relaciones y asientos, revisiones positivas, puntos ordenados por posición con lugares/instantes completos, boardingAt correspondiente al embarque elegido y referencia de inventario congelado. El proveedor es la autoridad de la elegibilidad temporal; el navegador no aporta reloj/tenant/inventario.
- DTO interno consumido: tripId, cooperativeId, routeSheetId, assignmentId, requiredServiceId, frequencyId, busId, programmingRevision, tariffRevision, inventorySnapshotId, inventoryRevision, routePointCount, routePoints, seatIds, fromPosition, toPosition, boardingAt y confirmedThroughExclusive. La tarifa/política acompañan el DTO de origen, pero no se calculan ni muestran importes en este incremento.
- Proyectar únicamente el snapshot mínimo al cálculo existente. El lector usa cooperativa/viaje derivados; RESERVED y SOLD efectivos bloquean superposición, incluida revisión. La salida sigue siendo { seats: [{ seatId, status }] }, sin datos personales o metadatos comerciales.
- null del proveedor -> BOOKING_TRIP_UNAVAILABLE (404); COMMERCIAL_TRIP_INVALID -> BOOKING_VALIDATION_ERROR (400); indisponibilidad conocida -> BOOKING_TRIP_SERVICE_UNAVAILABLE (503). Snapshot incoherente -> BOOKING_TRIP_DATA_INTEGRITY_ERROR (500). Otros errores se propagan al manejo seguro general (500), nunca lista libre.
- Mantener el puerto antiguo solo para consumidores/pruebas internos existentes que lo inyectan explícitamente. El servidor exige y conecta el proveedor por tramo real; su ausencia falla composición antes de escuchar HTTP. No hay fallback de producción a inventario simulado.

### Separación de alcance

Resumen/creación conservan su configuración previa: conectarlos requiere tarifas/acreditación y revalidación de L-01/L-03. Disponibilidad es informativa, no bloquea ni promete un asiento; la reserva futura debe revalidar dentro de la transacción. Sustitución de buses/reubicación requiere un contrato separado con David/Edwin. No se edita código de esos módulos, migraciones ni dependencias.

### Verificación

Conservar pruebas históricas T2a. Añadir pruebas de puerto por segmento, DTO corrupto/otra identidad/posiciones antes de ocupaciones, error sin fallback, copia de datos, asientos congelados y privacidad. PostgreSQL: publicación real mediante APIs Route Sheets/Fleet/Frequencies y consulta HTTP CUSTOMER con Auth real; RESERVED/SOLD/revisión, adyacencia y errores. Arranque real con la composición actual; mantener pruebas de compra que siguen devolviendo indisponibilidad cuando falta su proveedor.

SOLID: adaptador independiente sobre API pública, validación pura del snapshot y reutilización del cálculo de ocupación. Sin interfaz nueva, no aplica DESIGN.md en este incremento. Ejecutar lint, format:check y npm test desde backend con PostgreSQL aislado. No modificar timeout de fotografías ni pruebas para obtener verde. Actualizar evidencia y estado con resultados reales; sin commit/push/merge hasta petición posterior de Leslie.


Adaptación de la prueba histórica de arranque: antes esperaba 503 por catálogo ausente en disponibilidad. Al componer el proveedor real, una entrada que no es UUID devuelve 400 y un viaje UUID inexistente 404. Se exige ambos resultados y se conservan health 200, cero reservas/ocupaciones y cierre stop; se añade que summary mantiene 503 mientras no se conecte su proveedor. No se debilita el aislamiento ni se habilita inventario ficticio para satisfacer la expectativa antigua.


## 16. Resultado anterior sobre 65957a9 y límites de verificación

Implementado §15 sobre 65957a9, sin commit/push ni integración. 28/28 unitarias dirigidas finales y 32/32 integraciones HTTP dirigidas aprobadas (incluyen las cuatro nuevas y la prueba de arranque adaptada). Servidor real, Auth, publicación de hoja, inventario congelado y ocupaciones PostgreSQL comprobados.

npm test global ejecutado: 1795/1795 unitarias (92 suites); integración 566/568 (43/45 suites), 607,854 s, salida 1. Dos fallos: timeout original de fotografías de Fleet y expectativa antigua de 503 en disponibilidad al arrancar. Esta última se adaptó al contrato nuevo conforme a §15 y pasó en la repetición dirigida de 32 pruebas; no hubo cambio productivo para ocultar el fallo. No se recalcula el conteo global ni se declara verde una suite completa no repetida tras esa adaptación. El timeout permanece sin cambios y conserva su resultado real.

Lint y formato propio (12 JS) aprobados; format:check global conserva 17 archivos ajenos. [Evidencia](../evidence/BOOK-02-L02/2026-11-03-disponibilidad-real.md), [descripción preparada](../evidence/BOOK-02-L02/descripcion-pr-disponibilidad.md). Revisión humana pendiente. Cotización/creación/acreditación, invitados, sustitución y pantallas no quedan implementados por este incremento.


## 17. Revisión y guardado sobre renovación integrada

Leslie solicita continuar con el paso recomendado de revisión y guardado del incremento. Antes del commit se comprobó origin/develop 9920792, con ROUTE-SHEETS-08/PR #68 y catálogo 23. findBookableForSegment y el DTO que consume disponibilidad conservan su contrato. Se avanzó la rama sin commits exclusivos por fast-forward, conservando respaldo 7cf67dc3de02420093087d68e65a41ae1ec7e4fb; no hubo merge/rebase ni cambios a main/develop.

Único conflicto en esta spec: se conservan tanto la respuesta de Leslie transmitida por David como §§15–16 y las actualizaciones del equipo. El registro de David no autorizaba implementación por sí mismo; el alcance local de disponibilidad y su revisión/guardado proceden de las solicitudes posteriores de Leslie. La revalidación de creación y la sustitución continúan fuera de este incremento.

Repetir controles sobre catálogo 23 y la prueba de arranque ya adaptada; no tratar los resultados antiguos como validación de la base nueva. El código del adaptador y la consulta no cambia al conciliar la renovación. Se autoriza guardar un commit local; publicación/PR de esta rama aún pendientes de petición específica.


Resultado final sobre 9920792: npm test aprobado, 1838/1838 unitarias (95 suites) y 581/581 integraciones (46 suites), salida 0. Total 2419 pruebas y 141 suites. Integración 337,724 s. Incluye arranque y prueba HTTP adaptada, hoja publicada con parada, ocupaciones persistidas y las pruebas integradas de renovación. No cambió código productivo al conciliar la base.

Lint y formato propio (12 JS) aprobados; format:check global mantiene 17 archivos ajenos. Fotografías pasó sin cambiar código/límite; sus fallos anteriores conservan fecha/alcance histórico y no se declaran corregidos de forma determinista. Diff revisado. Checkpoint local autorizado: feat(reservas): conecta la disponibilidad con viajes publicados. Publicación, PR y revisión humana pendientes; no integración atribuida.


## 18. Conciliación de PR #70 con Pagos integrado — 4 de noviembre de 2026

Leslie solicita corregir los conflictos de la PR publicada. Cabeza e262428, base develop 9f7ac91, con lectura/carga productivas y procedencia de Pagos. Se incorpora develop en la misma rama mediante merge sin rebase ni force-push; no se integra la PR ni se cambia a main/develop. Se conservan las migraciones/contratos de Pagos, sin editarlos.

Conflictos reales: server.js y tests/unit/server.test.js. La composición conserva Bookings con availabilityQueries reales; paymentReceipt recibe su createPaymentProofReceiver; carga y lectura reciben sus paymentQueries, y createApp conserva paymentReview. El trabajador de expiración/cierre sigue igual. Se preservan las aserciones de ambos lados y se adapta el doble de Route Sheets en la prueba de composición de Pagos, añadiendo la comprobación del proveedor de disponibilidad. Estado-proyecto se fusionó automáticamente conservando ambos registros.

Pruebas requeridas antes de publicar: unitarias de ambas composiciones/adaptador, integraciones reales de disponibilidad/carga/lectura/recepción, lint/formato/npm test completos y arranque real con catálogo actual. No alterar tests/timeouts de fotografías ni inventar cierre/CI/aprobación humana. La corrección solicitada autoriza commit y push únicamente en la rama de la PR #70.


Evidencia de conciliación: [PR #70](../evidence/BOOK-02-L02/2026-11-04-conciliacion-pr70.md). El catálogo 24 integrado rechaza el catálogo previo de 23 con renovación aplicada antes de procedencia; comprobado sin cambios en copia efímera. No se alteran migraciones o historial para resolverlo incidentalmente: las bases persistentes con esa historia requieren plan aparte con Pablo/Shirley. No se afirma haber encontrado una base persistente en ese estado.

Resultado de conciliación: 1842 unitarias y 588 integraciones aprobadas (2430 pruebas, 143 suites), incluido arranque real. Lint y formato de los tres JS conciliados aprobados; formato global conserva 17 archivos ajenos. Fotografías pasó sin alterar su timeout. Entorno PostgreSQL temporal eliminado. Corrección lista para publicar en la PR #70; revisión humana e integración pendientes.
