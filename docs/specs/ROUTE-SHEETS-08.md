# ROUTE-SHEETS-08: Renovación explícita de ciclos

- **ID local:** ROUTE-SHEETS-08, sin ticket externo. Gestor externo pendiente para después de la primera revisión.
- **Referencia de planificación:** D-05, primera tarea: renovación. Paradas operativas y sustitución tendrán specs separadas; no se les asigna un ID definitivo aquí.
- **Módulo / responsable:** `route-sheets` / David, por solicitud expresa en esta sesión.
- **Revisora propuesta:** Leslie. Su respuesta permite continuar la preparación de renovación; no confirma aceptación de revisar código ni aprobación de esta spec completa.
- **Estado:** Sección 0 en `80c2211`, sección 1 en `4ff9723`; sección 2 implementada localmente, con verificación registrada en §16. Revisión humana e integración pendientes.
- **Fecha:** 3 de noviembre de 2026, America/Guayaquil.
- **Rama / base comprobada:** `feature/ROUTE-SHEETS-08-renovacion-ciclos`, ya existente en `072f845`, inicialmente limpia. Se reutiliza sin merge/rebase. Fetch comprobó `origin/develop` en `4bb6861`, que incorpora FLEET-09 T1. La base de implementación deberá contrastarse con ese avance; esta sección no acredita la combinación ni modifica la historia Git.
- **Autorización:** David pidió realizar únicamente la sección 0 y aportó la respuesta de Leslie. Autoriza planificación, registro del acuerdo y seguimiento; no código, migraciones, commits, publicación ni cambios en Bookings/Fleet.
- **Autorización posterior de sección 1:** David solicitó implementarla y respondió expresamente «Confirmo las cuatro recomendaciones» a Q1–Q4 en esta sesión del 3 de noviembre. Autoriza dominio, contrato de puertos y pruebas de esta sección; no sección 2, commits, publicación ni cambios de módulos ajenos.
- **Autorización posterior de sección 2:** David pidió expresamente implementar sección 2 y preparar los textos de PR y posterior aprobación. Incluye persistencia, endpoint, composición, migración nueva/catálogo y adaptación de fixtures al nuevo esquema. No autoriza commits, push, integración ni envío de mensajes.

## 1. Objetivo y fuentes

Permitir al administrador preparar el siguiente ciclo a partir de una hoja publicada verificable, conservar el historial comercial y confirmar su publicación de manera explícita. Crear el borrador no amplía el horizonte de venta ni modifica viajes o reservas anteriores.

Fuentes: [reglas](../business-rules.md), [acuerdos](../acuerdos-primera-entrega.md), [arquitectura](../architecture.md), [convenciones](../conventions.md), [calidad](../calidad.md), [protocolo de defectos](../errores-inducidos.md), [coordinación](../equipo-y-acuerdos.md), [ROUTE-SHEETS-04](ROUTE-SHEETS-04.md), [ROUTE-SHEETS-05](ROUTE-SHEETS-05.md), [ROUTE-SHEETS-06](ROUTE-SHEETS-06.md), [ROUTE-SHEETS-07](ROUTE-SHEETS-07.md), [FLEET-09](FLEET-09.md), [BOOK-02/L-02](BOOK-02-L02.md), [BOOK-05/L-01](BOOK-05-L01.md), [BOOK-07/L-05](BOOK-07-L05.md) y ADR [0006](../adr/0006-serializacion-de-programacion.md) y [0005 de lecturas públicas](../adr/0005-lecturas-publicas-en-transaccion.md).

## 2. Reglas que se conservan

- RN-02: tenant y actor de la identidad autenticada y verificada; el body no elige cooperativa. Solo COOPERATIVE_ADMIN de la cooperativa de la hoja puede preparar/publicar.
- RN-20–23 y RN-30–32: origen/destino/hora de frecuencia inmutables, resolución ANT, programación fechada, cobertura, continuidad de lugar, preparación explícita y bloqueos válidos; contrastar compromisos de otras hojas.
- Dos ciclos totales inicialmente, incluida base. Tras terminar el primero puede confirmarse el siguiente conservando como máximo dos períodos no terminados confirmados. La numeración histórica puede superar dos; no renumerar ciclos ni crear series paralelas para eludir el límite.
- Duración común L días y continuación exacta desde el fin exclusivo del último ciclo publicado de la serie. Fechas de programación en America/Guayaquil con instantes completos; no usar hoy + 28 días ni hoy + 2L.
- Confirmación humana explícita. Borrador, consulta, reloj o petición de disponibilidad no publican ni renuevan automáticamente. El horizonte solo cambia al publicar un ciclo consecutivo válido.
- Tarifas: copia editable en un nuevo borrador; publicación congela la nueva política y precios. Inventario comercial se captura para la nueva hoja desde Fleet por su API pública al publicar. Las copias previas permanecen intactas.
- RN-40: ningún ID o compromiso RESERVED/SOLD anterior se mueve por renovar. Renovación no sustituye un bus en viajes existentes ni modifica reservas en revisión.

## 3. Situación contrastada y alcance

En `072f845` existen programación persistida y reemplazo de borrador (ROUTE-SHEETS-06), tarifa editable/congelada (05) y series/ciclos/viajes comerciales (07). Publicar una hoja ya programada con `seriesId` permite continuar una serie, pero no copia una hoja ni crea su renovación. `plan-commercial-cycle.js` controla duración, continuidad y máximo de ciclos publicados no terminados. `validate-programming-commitments.js` es más conservador al guardar: cuenta también los borradores programados no terminados.

La ruta antigua de generación de ciclos y `purchase-window` no acreditan este contrato; no deben usarse para implementar renovación ni para obtener el horizonte comercial. Los guards actuales rechazan operaciones legadas en hojas programadas. No se eliminan como atajo.

**Incluye, tras aprobar su implementación:** un caso de uso que prepara un nuevo borrador, trazabilidad de la hoja origen, identidades nuevas, programación desplazada explícitamente, copia de tarifa editable, reintento seguro, validación completa y vinculación inequívoca con la serie al publicar mediante el flujo existente.

**Fuera:** gestión/cambio de REST, MAINTENANCE o STANDBY como operación independiente; sustitución por avería; reubicación/comunicación/recalculo de compras anteriores; búsquedas; cambios en Reservas, Pagos o Fleet; optimización automática; edición del bus; frontend de renovación; Chofer/Controlador y Wallet. No se cambia la regla de desactivación de frecuencias desde esta tarea.

## 4. Flujo propuesto para revisar antes de implementar

1. El administrador solicita preparar la renovación de una hoja publicada. El servidor deriva cooperativa/grupo/serie y verifica acceso, estado, programación/tarifa verificables y que el origen sea el último ciclo publicado de esa serie.
2. Bajo la serialización de Route Sheets de ADR 0006, obtiene las revisiones y compromisos vigentes y calcula el siguiente intervalo contiguo, con la misma duración L. No acepta fechas/tenant/precios/inventario autoritativos del navegador.
3. Construye una hoja DRAFT con IDs nuevos de hoja, servicios requeridos, asignaciones, actividades y bloqueos. Conserva referencias a buses/frecuencias existentes; no crea nuevos buses ni reutiliza IDs de asignaciones/viajes anteriores.
4. Desplaza los instantes del patrón respecto de su origen en L días, incluida llegada, salida de cada punto, preparación/bloqueos y disponibilidad declarada. Revalida límites, hora autorizada, repetibilidad, ubicación y compromisos reales; desplazar una disponibilidad no prueba por sí solo que un bus esté físicamente libre. Fuente incompleta o incompatible produce conflicto sin guardar un borrador parcial.
5. Copia precios y porcentajes de la tarifa congelada del origen como tarifa editable del destino, con revisiones propias. No copia reservas, ocupaciones, tripId, inventario comercial ni estado PUBLISHED.
6. Persiste de forma atómica borrador, vínculo de procedencia/serie, programación, tarifa editable, actor/fecha y clave de reintento. Una respuesta perdida permite recuperar el mismo resultado sin duplicar el siguiente ciclo.
7. El administrador revisa/edita el borrador con los casos de uso vigentes y realiza una publicación explícita. La publicación revalida cupo, pertenencia a la serie, revisión/continuidad, frecuencias, buses, programación y tarifa; crea nuevos viajes y nueva copia comercial mediante ROUTE-SHEETS-07. El vínculo persistido debe impedir publicar la renovación como otra serie o con otro `seriesId`.

Q1–Q4 fueron confirmadas después por David según §10. Su respuesta autoriza la concreción de dominio de sección 1; no se presume aceptación de Leslie de esos detalles ni disponibilidad del endpoint/persistencia de sección 2.

## 5. Datos y persistencia propuestos

Entrada definida en sección 1: `sourceRouteSheetId`, `expectedProgrammingRevision`, `expectedTariffRevision` y `requestKey` según §15. Tenant/autor vienen de sesión; tiempo del reloj del servidor inyectable en pruebas. La distribución ruta/body y su validación HTTP se implementarán en sección 2.

Salida propuesta: ID del nuevo borrador, ID de origen, serie vinculada, inicio/fin exclusivo, duración y revisiones propias. La respuesta indica DRAFT y no presenta viajes vendibles ni un horizonte ampliado. Una repetición idéntica devuelve el mismo destino; reutilizar la clave con otra operación produce conflicto.

Persistencia conceptual propia de Route Sheets: relación origen/destino/serie, revisiones de origen, clave, actor y fecha. Se definirán tabla/columnas y migración nueva solo al autorizar implementación; no modificar migraciones integradas ni acceder por SQL a tablas de otros módulos. Debe poder comprobarse unicidad y procedencia sin inferirlas por fechas.

## 6. Contrato HTTP candidato

No hay endpoint nuevo implementado. Propuesta: `POST /api/v1/route-sheets/:id/renewals`, COOPERATIVE_ADMIN con CSRF, donde `:id` identifica el origen propio. La ruta/payload se aprueban con la spec antes de código.

Resultados previstos: 201 al preparar, 200 al recuperar el mismo resultado; 400 entrada inválida; 401/403 sesión/rol; 404 origen ausente o ajeno sin revelar otro tenant; 409 revisión, origen no elegible, agenda, continuidad, cupo o solicitud incompatibles; 503 proveedor necesario ausente/fallido. Códigos concretos y traducción deben respetar los errores existentes y definirse con el caso de uso. Un fallo técnico nunca equivale a hoja libre ni a renovación realizada.

## 7. Criterios de aceptación y revisión

Casillas pendientes de aceptación humana. Las comprobaciones automatizadas locales y sus límites se registran en §15–16; no equivalen a aprobar la PR ni a integrar la rama.

- [ ] Dada una hoja publicada válida y una solicitud autorizada, preparar produce un único borrador contiguo con L igual, IDs nuevos y procedencia verificable; origen e historia quedan idénticos.
- [ ] Dado un borrador renovado, editar su tarifa no cambia precios/porcentajes de hojas publicadas ni altera reservas previas.
- [ ] Dado un borrador preparado, consultarlo no genera viajes ni amplía `confirmedThroughExclusive`; solo publicar explícitamente puede hacerlo.
- [ ] Dados dos períodos confirmados no terminados, confirmar otro falla. En el fin exclusivo del primero se libera el cupo para el siguiente contiguo sin renumerar la historia.
- [ ] Dados un bus ocupado, mantenimiento/descanso superpuesto, frecuencia inactiva, falta de cobertura o continuidad inválida, la operación pertinente falla sin guardar resultados parciales.
- [ ] Dadas peticiones simultáneas o una respuesta perdida, el mismo siguiente ciclo se recupera sin duplicar hoja, programación, tarifa ni publicación comercial.
- [ ] Dada una revisión desactualizada, un origen intermedio, una serie ajena o un fallo de proveedor, se responde conflicto/error sin convertirlo en ausencia de compromisos.
- [ ] Dadas reservas/ventas previas, renovar conserva sus tripId, seatId, tramos, importes y estado; no las consulta como listas vacías ficticias ni las reasigna.
- [ ] Dado un fallo entre escrituras, rollback conserva el esquema de negocio anterior; preparar/publicar comparten el orden de serialización acordado y no permiten eludir los límites mediante otra petición.
- [ ] Dado un borrador de renovación, no se permite publicarlo como una serie distinta de la registrada ni usar una ruta legada para saltar validaciones.

## 8. Bordes y límites por resolver

Origen legado sin programación o copia tarifaria verificable: error de fuente no verificable, sin reconstrucción ficticia; origen conocido pero no publicado: conflicto. Q4 confirma rechazar el siguiente período completamente pasado; no saltar fechas silenciosamente. La fecha/hora exacta de límite se prueba con reloj inyectable.

Descanso/mantenimiento copiados mantienen su significado; no se convierten en disponibilidad de respaldo. Un bus que ya no sirve para la nueva programación bloquea la validación; sustituirlo en viajes vendidos corresponde a otra spec.

Los borradores programados ya consumen cupo en el validador de compromisos actual: Q1 conserva ese comportamiento. Permitir preparar un tercero requeriría otra decisión explícita; no debilitar pruebas o confundir ese conteo con el máximo comercial de publicados.

## 9. Verificación prevista de secciones funcionales

- Unitarias: copia y desplazamiento del patrón completo, identidades nuevas, revisiones, límites exactos de ciclo y semántica de idempotencia/origen.
- PostgreSQL aislado: alta del borrador íntegro, rollback, aislamiento, simultaneidad de preparar/publicar, conservación de historia y lectura posterior desde APIs reales.
- Contrato: borrador sin viajes/horizonte nuevo; publicación con nueva copia comercial y viaje, manteniendo las referencias ya consumidas por Bookings. Fallos reales de proveedores se propagan.
- Lint, `format:check` y `npm test` desde backend según [testing-database.md](../testing-database.md), sin leer `.env`; arranque real si cambia composición. Registrar resultados reales, incluidos fallos previos, sin ampliar timeouts para ocultarlos.

## 10. Decisiones propias y coordinación con Leslie

### Decisiones de renovación confirmadas por David

| ID | Pregunta | Decisión confirmada / impacto |
|---|---|---|
| Q1 | ¿Se prepara un tercer borrador mientras hay dos ciclos no terminados? | Conservar el conteo conservador de programación y preparar cuando haya cupo. Permitir un borrador adicional requeriría otro cambio explícito. No cambiar el límite comercial de dos publicados. |
| Q2 | ¿Desde qué hoja se copia y cómo se modifica el destino? | Únicamente último ciclo publicado de la serie, copia íntegra con tarifa congelada como nuevo borrador editable y edición por los casos de uso existentes. Rechazar origen legado/incompleto. |
| Q3 | ¿Cómo se identifica un reintento y se vincula la publicación? | Clave de solicitud y vínculo persistido origen/destino/serie, unicidad del siguiente período y publicación derivando/contrastando el vínculo. El contrato de sección 1 se detalla en §15 y en el puerto. |
| Q4 | ¿Qué hacer si la serie terminó y su siguiente intervalo ya pasó? | Rechazar si el siguiente intervalo terminó (`endExclusive <= now`) y usar una nueva base manual validada. No saltar fechas ni recrear viajes históricos; un intervalo que todavía no termina no se considera completamente pasado. |

Fuente: respuesta directa de David «Confirmo las cuatro recomendaciones», tras autorizar sección 1, el 3 de noviembre de 2026. No se atribuye aprobación adicional a Leslie, Edwin o Shirley. Los demás acuerdos compartidos mantienen su estado y alcance.

### Decisión compartida: preparar renovación sin modificar compromisos previos

- **Estado:** Acordado el límite de preparación documental; diseño de renovación y aprobación funcional pendientes.
- **Fecha y participantes:** 3 de noviembre de 2026. David solicita sección 0 y aporta textualmente la respuesta de Leslie; no hubo envío del asistente.
- **Reglas/specs:** RN-02/30–32/40, ROUTE-SHEETS-04/07 y esta spec; BOOK-02/L-02, BOOK-05/L-01 y BOOK-07/L-05 para contratos relacionados.
- **Respuesta humana:** Leslie indicó: «Puedes continuar preparando renovación en ROUTE-SHEETS-08 conservando viajes y reservas anteriores. La sustitución tendrá su contrato e incremento separados».
- **Decisión e impacto:** se prepara solo renovación. No mover ni recalcular compras anteriores. Las siguientes respuestas de Leslie se registran con su estado real, sin declarar nuevas APIs disponibles.
- **Responsable / revisión:** David prepara esta spec; Leslie es revisora propuesta, no aceptación atribuida de revisión de código.
- **Trabajo independiente:** diseñar copia, continuidad, idempotencia y validación de nueva hoja. Sustitución queda dependiente de contratos públicos y acuerdo operativo todavía pendientes.

| Respuesta recibida de Leslie | Estado registrado y consecuencia |
|---|---|
| Le sirve `findBookableForSegment({ tripId, fromPosition, toPosition })`; solicita identidad, tenant, hoja/asignación, bus, embarque fechado, referencia de inventario, tarifa en centavos y política congelada con revisión; revalidación al reservar bajo protección de concurrencia. | Aceptación de la firma propuesta, condicionada a concretar respuesta/errores y revalidación. ROUTE-SHEETS-07 ya implementa la consulta por par; no se afirma adaptado ni conectado el consumidor de Bookings. La integración tiene su incremento propio y no bloquea redactar renovación. |
| No tiene API pública de detalle de ocupaciones para sustitución; propone consulta autorizada por viaje con bookingId, seatId, estado, posiciones inicial/final, RESERVED/SOLD efectivos y comprobante en revisión, sin datos personales innecesarios. Falta revisión de lectura y no hay commit disponible. | Propuesta sin implementación acreditada. Booleanos anteriores no identifican afectados. Nombre exacto, permisos, revisión y semántica se cierran en la futura spec de sustitución y la correspondiente de Bookings. |
| El bloqueo interno tenant/viaje no coordina por sí solo la sustitución; acordar protocolo común, orden, revalidación y rollback. | Riesgo compartido reconocido; protocolo pendiente. No compartir repositorios ni escribir tablas ajenas. ADR 0006 sirve para escrituras de Route Sheets, no como solución del bloqueo entre módulos. |
| Conservar motivo/autor, buses anterior/nuevo y mapa explícito entre seatId; cerrar con Edwin versión de inventario/compatibilidad; sin correspondencia válida para todos los compromisos se bloquea sustitución automática. | Separación y condición de bloqueo confirmadas; versión de Fleet y contrato de aplicación del mapa pendientes. Comparar posiciones no significa reutilizar seatId de otro bus. |
| Autorización manual, comunicación y registro siguen pendientes; cambios de importes se revisan con Shirley y no se recalculan compras anteriores automáticamente. | Pendiente operativo; no se asignan personas ni se inventa aceptación de Edwin/Shirley. No habilitar sustitución automática sin este cierre. |

## 11. Defecto inducido

No aplica. No se introduce ni corrige un defecto académico; la primera revisión sigue el protocolo independiente.

## 12. Diseño SOLID y usabilidad

Separar transformación/validación pura del patrón (domain), coordinación del caso de uso por puertos (application), transacción de tablas propias (infrastructure) y traducción HTTP (interfaces). Reutilizar validadores y publicación reales; no invocar controladores desde aplicación ni reimplementar otra autoridad tarifaria.

El puerto de renovación debe ser pequeño; los repositorios/dobles deben preservar transacción, errores e idempotencia. La composición conecta proveedores por sus APIs públicas. No se crea una jerarquía para futuras sustituciones ni se refactorizan módulos ajenos.

Sin interfaz de usuario en esta spec: no se adopta ni modifica un diseño frontend ni se acredita usabilidad visual. El contrato distinguirá borrador preparado, publicación confirmada, conflicto y resultado incierto. La futura pantalla requerirá spec y aplicación explícita de DESIGN.md.

## 13. Secciones y evidencia

| Sección | Resultado pequeño | Autorización / archivos compartidos |
|---|---|---|
| 0 | Esta spec, respuesta humana trazada y fila de estado; referencias desde specs afectadas. | Autorizada por David; solo Markdown. |
| 1 | Transformación y contrato de renovación, puertos/errores e idempotencia definidos, pruebas de dominio. | Autorizada por David con Q1–Q4 confirmadas; implementación local, evidencia en §15. |
| 2 | Caso de uso de preparación persistida y endpoint, vínculo con publicación y pruebas reales de concurrencia/rollback/arranque. | Autorizada expresamente por David el 3 de noviembre; implementación local y evidencia en §16. |

Una sección funcional reúne código, pruebas y evidencia en un cambio lógico; commits solo por petición humana. Esta planificación no concede autorización para las secciones siguientes.

Evidencia de sección 0: rama inicialmente limpia en `072f845`, `origin/develop` comprobado en `4bb6861`; inspección de `plan-commercial-cycle`, `validate-programming-commitments`, publicación, DTO por tramo y ADR. Diff documental revisado y `git diff --check` aprobado; 162 referencias locales de los cinco documentos comprobadas sin destinos inexistentes (no se verifican URLs externas ni anclas). También se comprueba el archivo nuevo sin espacios finales/conflictos. No se ejecutan lint/Jest/arranque porque solo cambia Markdown; sin pruebas de producto, migraciones ni nueva integración acreditadas. Asistencia de Codex en planificación/documentación.

## 14. Revisión y siguiente paso

Q1–Q4 y secciones 1–2 autorizadas por David; revisión humana y aceptación de la revisora propuesta pendientes. Sección 2 parte de `4ff9723` sin incorporar el avance de `develop`; no se acredita combinación final. Las respuestas de Leslie no autorizan cambios de su módulo ni sustitución. No hay PR nueva, integración ni cierre de tarea acreditados.

## 15. Sección 1 — plan puro y contrato transaccional

Base `80c2211`, rama `feature/ROUTE-SHEETS-08-renovacion-ciclos`, inicialmente limpia. David autorizó la sección y confirmó Q1–Q4 en esta sesión. Solo se añaden archivos nuevos de dominio/puertos/pruebas y se actualiza evidencia; ningún caso de uso público, migración, endpoint o cambio de composición.

`domain/services/plan-route-sheet-renewal.js` valida origen publicado propio, revisiones esperadas y último ciclo de la serie; exige período de origen coherente y produce plan DRAFT contiguo con identidades nuevas, actor/fecha y revisiones propias iniciales 1. Reutiliza validación de ciclos y compromisos, incluido el conteo de borradores. No genera viajes, no copia inventario/ocupaciones ni modifica el horizonte. Los proveedores actuales de Fleet/Frecuencias deberán revalidarse en aplicación dentro de sección 2; el plan puro no sustituye esa comprobación.

`renewal-programming.js` usa la solicitud canónica de programación y los recorridos de la tarifa congelada para validar cobertura, vínculos, todos los puntos, continuidad, preparación y repetibilidad. Desplaza disponibilidad, servicios/traslados, puntos y REST/MAINTENANCE en L días y renueva sus IDs. El cálculo no depende de zona horaria del equipo ni del reloj global. La tarifa se restaura en una copia separada, preservando precios explícitos no aditivos y todos los porcentajes, incluidos cero. El objeto de intercambio es inmutable; editable se refiere al estado del nuevo borrador, no a mutar objetos del dominio.

`renewal-request.js` define entrada estricta de cuatro campos: sourceRouteSheetId, expectedProgrammingRevision, expectedTariffRevision y requestKey. IDs/clave UUID canónicos, revisiones positivas hasta 2147483646. `assertSameRenewalRequest` compara la solicitud canónica con el registro previo y rechaza clave/origen/revisiones distintos. [Puerto de renovación](../../backend/src/modules/route-sheets/domain/ports/renewal-ports.md): sesión de Route Sheets bajo ADR 0006, recuperación antes de revalidar reloj/cupo, unicidad tenant/clave y tenant/serie/inicio, misma transacción para todos los registros y vínculo obligatorio en publicación. Otra clave para un destino ya preparado produce conflicto. Al cerrar sección 1, la idempotencia durable y la exclusión concurrente eran contratos; su implementación posterior se registra en §16.

Errores propios: petición inválida 400; origen ausente/ajeno 404; origen no publicado/no último, revisiones incompatibles, solicitud distinta e intervalo completamente pasado 409; fuente ilegible/no disponible o generador defectuoso 503. Los errores existentes de agenda/ciclo conservan sus códigos. No se convierte falta de proveedor en lista vacía. El generador UUID y reloj son suministrados por composición; no se importa Express/pg/adaptadores desde dominio.

Verificación final del código con Node 24.21.0/Linux y PostgreSQL 16.13 aislado, proyecto `busesuta-route08-s1`: **1774/1774 unitarias (91 suites), incluidas 32 nuevas**, y **537/538 integraciones (42 suites)**. Único fallo: timeout de 20 segundos en `fleet/bus-photo-storage.test.js`, caso «prepara y promueve todos los bytes sin conservar nombres ni rutas del cliente», ya registrado anteriormente; no se modifica esa prueba ni su límite y no se declara verde la suite global. Todas las suites de programación/tarifario/viajes, Reservas y migraciones aprobaron. No cambia composición, por lo que no se ejecuta un escenario de arranque adicional al ya cubierto por las suites existentes.

Lint, Prettier de los cinco JS nuevos, diff revisado y `git diff --check` aprobados; `format:check` global mantiene 39 archivos previos sin cambios. La validación inicial corrigió solo una referencia nueva de prueba a `globalThis.structuredClone` señalada por ESLint; los 32 casos finales también aprobaron en Windows. La primera ejecución de `npm test` aprobó 1772 unitarias (con los 30 casos iniciales), pero la integración se lanzó sin URL aislada y sus guards la rechazaron; ese intento no acredita integración y tampoco se oculta. Docker estaba apagado y se inició Docker Desktop desde su instalación local antes de repetir con la URL explícita de la base aislada.

La repetición final instaló dependencias del lock con `npm ci` solo en un contenedor efímero; se verificó lock idéntico al de la imagen para reutilizar sus binarios nativos de Sharp. No se actualizaron dependencias ni archivos del proyecto, no se leyó `.env` y los recursos propios de PostgreSQL se retiran al terminar. Asistencia de Codex en implementación/pruebas/documentación; sin commits, publicación ni integración. Mensaje sugerido para este cambio lógico: `feat(hojas-ruta): prepara el dominio de renovación de ciclos`.

## 16. Sección 2 — preparación persistida y publicación vinculada

Implementación local sobre `4ff9723`, en `feature/ROUTE-SHEETS-08-renovacion-ciclos`, inicialmente limpia. Se aplica la guía del proyecto; no se cambia código de negocio de Fleet, Frecuencias, Pagos o Reservas ni dependencias. Revisión humana e integración pendientes.

### Contrato HTTP implementado

`POST /api/v1/route-sheets/:id/renewals`, JSON con `expectedProgrammingRevision`, `expectedTariffRevision` y `requestKey` UUID. Solo COOPERATIVE_ADMIN autenticado de la cooperativa, con CSRF válido. Se rechazan campos adicionales; tenant y autor proceden de sesión. Responde `201 { renewal, replayed: false }` al preparar y `200 { renewal, replayed: true }` al recuperar. La respuesta tiene `Cache-Control: no-store`.

`renewal` contiene routeSheetId del destino, sourceRouteSheetId, seriesId, status DRAFT, startAt/endExclusive UTC, cycleLengthDays, programmingRevision/tariffRevision iniciales 1, createdBy/createdAt. Es el recibo original de preparación: un replay conserva DRAFT y las revisiones iniciales aunque después se haya editado/publicado el destino; para su estado actual se usan las consultas existentes. No se presenta ese recibo como estado actual de la hoja.

400 para petición inválida; 401/403 para autenticación/autorización/CSRF; 404 para origen ausente/ajeno; 409 para origen no publicado/no último, revisiones, cupo/agenda/período o clave incompatible; errores de fuente/proveedores conservan 503 cuando corresponda. Un fallo al confirmar COMMIT devuelve `ROUTE_RENEWAL_RESULT_UNCERTAIN`/503 con instrucción de reintentar usando la misma clave, sin generar otra automáticamente.

### Persistencia y límites

Migración nueva `1794160000000-route-sheet-renewals`, añadida al catálogo. Unicidad tenant/clave y tenant/serie/inicio, referencias propias a origen/destino/serie, procedencia inmutable y down bloqueado si contiene renovaciones. Un trigger contrasta serie, tenant e intervalo al insertar el ciclo comercial del destino. No se editan migraciones anteriores.

El repositorio usa el advisory lock de ADR 0006 antes de filas. Lee replay antes de reloj/fuentes; valida origen/serie/tarifa congelada y compromisos completos, incluido el propio origen. Aplicación contrasta buses y frecuencias vigentes mediante puertos públicos; comprueba que los puntos coincidan con la tarifa copiada. Cabecera, tarifa, programación con IDs nuevos, procedencia/recibo y auditoría RENEWAL_PREPARE se escriben en una sola transacción. Un fallo revierte todas esas escrituras.

Preparar no crea viajes ni inventarios, ni amplía el horizonte confirmado. Publicar sigue siendo una petición humana separada: deriva la serie guardada y rechaza otra serie o un período/grupo incompatible; repite las validaciones actuales de publicación. Tarifa y programación del borrador siguen siendo editables con control de revisión. La copia comercial anterior permanece intacta. No hay escrituras ni reasignaciones en Bookings.

El repositorio de tarifa reconoce la ausencia de la tabla solo durante una reversión legítima sin renovaciones: el down nuevo impide ese estado cuando hay procedencia. Las demás lecturas fallidas no se convierten en ausencia. Las pruebas antiguas de publicación siguen verificando su migración anterior durante la reversión.

### Verificación y alcance de las adaptaciones de pruebas

Se añaden pruebas de aplicación y de integración con arranque real mediante `start`: copia/preparación/publicación, IDs distintos, tarifa editable, período vinculado, revisiones, aislamiento, CSRF, concurrencia, límite de dos, rollback después de escrituras, procedencia inmutable y recuperación desde otra instancia tras perder respuesta de COMMIT. Los dobles de fallo solo existen en pruebas. No se añaden banderas de fallo al producto.

El catálogo ahora contiene 21 migraciones: se actualizan sus expectativas exactas y se comprueba down/reaplicación de la tabla nueva conservando datos anteriores. Cuatro fixtures que enumeraban todas las tablas en TRUNCATE incluyen route_sheet_renewals. La prueba de reversión de recibos selecciona su propia migración, baja primero las posteriores y las reaplica en finally; conserva las comprobaciones de rechazo, historial/estado intactos e inmutabilidad. Estas adaptaciones reflejan el nuevo esquema; no eliminan casos ni relajan reglas.

Repetición final del código con Node 24.21.0/Linux: **1785/1785 unitarias (93 suites), incluidas 11 nuevas de sección 2, y 12/12 integraciones de renovación con arranque real**, en una segunda base aislada para no interferir con la regresión global. Incluye validación íntegra del recibo durable: datos corruptos fallan con 503. Lint y Prettier de todos los JS modificados/nuevos aprobados. `format:check` global conserva los mismos 39 archivos previos sin formato, sin cambios en ellos. El diff completo fue revisado; `git diff --check` y búsqueda de conflictos aprobados. El intento inicial de unitarias en Windows aprobó 1764/1778; 14 fallaron por EACCES de conexiones HTTP locales. La repetición con Node 24/Linux aprobó 1778/1778 unitarias. La primera integración completa terminó con 497/548 aprobadas y 51 fallos: expectativas/fixtures incompatibles con la tabla nueva y el timeout de fotos de Fleet; se corrigieron las adaptaciones del esquema descritas arriba y se repitió. Se mantiene trazabilidad de los intentos fallidos.

La repetición de `npm test` con las adaptaciones de catálogo/fixtures aprobó 1778/1778 unitarias y **549/550 integraciones (43 suites)**. Único fallo: timeout de 20 segundos en `fleet/bus-photo-storage.test.js`, «prepara y promueve todos los bytes sin conservar nombres ni rutas del cliente», también documentado en sección 1. Las suites de migraciones, programación, tarifa, viajes, Reservas, Frecuencias y renovación aprobaron. Tras endurecer la validación del recibo, se repitieron todas las unitarias (1785) y las doce integraciones de renovación con el código final, como se indica arriba. No se declara verde la suite global ni se amplían timeouts. Antes de solicitar integración deben resolverse el resultado global y la comprobación contra develop.

No hay interfaz frontend, sustitución, gestión nueva de paradas ni cierre completo de D-05. No se acredita combinación con origin/develop: la evidencia final corresponde a esta rama/base. Asistencia de Codex en implementación, pruebas y documentación. No se han creado commits, enviado mensajes ni publicado/integrado la rama. PostgreSQL y las dos bases aisladas se retiran al terminar; no se leyó .env. Las dependencias del lock solo se instalaron en contenedores efímeros, con lock verificado antes de reutilizar binarios de Sharp; no se actualizaron dependencias del repositorio. Mensaje de commit sugerido: `feat(hojas-ruta): persiste la preparación de renovaciones`.
