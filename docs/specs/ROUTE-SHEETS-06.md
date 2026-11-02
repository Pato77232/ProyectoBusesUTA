# ROUTE-SHEETS-06: Programación multifrecuencia persistida

- **Referencia de planificación:** D-03; ID local, sin ticket externo.
- **Responsable:** David, por tarea seleccionada y petición expresa del solicitante.
- **Estado:** En desarrollo; sección 0 guardada en 2890d2b; sección 1 solicitada e implementada localmente, pendiente de revisión y commit. Sección 2 sin autorización de implementación.
- **Fecha:** 2 de noviembre de 2026, America/Guayaquil.
- **Rama / base comprobada:** feature/programacion-multifrecuencia-persistida, 8fdf7e4; árbol inicialmente limpio. La referencia local origin/develop coincide; no se hizo fetch ni se verificaron PR remotas en esta sesión.
- **Antecedentes:** D-01 integrado en 8886553; tarifario D-02 en 1fb0ade; corrección de pruebas presente en 1e9d956. Presencia en la historia local no acredita revisión humana nueva ni cierre integral.
- **Revisora propuesta:** Leslie, aceptación de esta revisión pendiente. Edwin participa en contratos de Fleet; no se presume aprobación suya de propuestas nuevas.
- **Autorización:** David solicitó sección 1 y confirmó expresamente P1–P4 en el chat. Autorizó después únicamente las listas TRUNCATE de cuatro suites antiguas para incorporar las tablas nuevas; no sus comprobaciones. No autorizó commits, sección 2 ni publicación.

## 1. Objetivo y fuentes

Permitir que el administrador guarde una programación manual verificable de varios servicios por bus y que la publicación compruebe su factibilidad. Reutilizar el dominio de [ROUTE-SHEETS-04](ROUTE-SHEETS-04.md) y conservar el tarifario de [ROUTE-SHEETS-05](ROUTE-SHEETS-05.md).

Fuentes: [reglas](../business-rules.md), RN-02, RN-20–23 y RN-30–32; [acuerdos](../acuerdos-primera-entrega.md), [arquitectura](../architecture.md), [convenciones](../conventions.md), [calidad](../calidad.md), [protocolo de acuerdos](../equipo-y-acuerdos.md), [flujo](../flujo-codex.md) y [ADR 0005](../adr/0005-lecturas-publicas-en-transaccion.md). Las actualizaciones iniciales de reglas y ROUTE-SHEETS-04 concretan el contrato multidiario frente a las formulaciones históricas de hoja diaria/conteos; no se reinterpreta una semana como un día.

## 2. Alcance y diagnóstico

Incluye un caso de uso de reemplazo atómico de programación completa de borrador, su consulta, migraciones nuevas, control de revisión/concurrencia y validación al publicar. No incluye optimización automática, catálogo de viajes, reservas, inventario de asientos, sustitución, renovación, frontend, Wallet ni Chofer/Controlador. D-04 expondrá el viaje comercializable; D-05 resolverá renovación y excepciones.

Código observado: asignaciones sin fechas, índices únicos por hoja/bus y hoja/frecuencia; AddAssignment impide repetir bus y compara conteos. Las hojas se identifican por fecha/grupo; ciclos antiguos usan semanas y no materializan servicios. El tarifario utiliza los IDs de frecuencias de las asignaciones. No basta con eliminar índices: hay que migrar datos, proteger todos los escritores y conservar la relación con la tarifa.

## 3. Reglas ya confirmadas que se conservan

- Patrón manual, duración explícita en días, servicios requeridos independientes de las asignaciones y cobertura exacta por frecuencia/instante.
- SERVICE y TRANSFER con salida/llegada fechadas y preparación explícita; continuidad inicial, intermedia y de repetición. REST/MAINTENANCE bloquean; STANDBY no constituye un bloqueo ni autoriza sustitución automática.
- Frecuencia activa, propia y con resolución ANT; origen, destino y hora autorizada inmutables. Bus propio y del grupo de la hoja. No comparar cantidades para inferir cobertura.
- Tiempos con offset explícito, zona continental America/Guayaquil; medianoche se representa con fecha nueva. Ocupación incluye preparación y usa fin exclusivo.
- Dos ciclos totales, base incluida; borradores no habilitan compra, no renovación automática ni renumeración histórica. Límite máximo de dos períodos no terminados por grupo, incluidos borradores según el validador de D-01.
- Tarifas explícitas por combinación, política y copia congeladas al publicar. No recalcular precios sumando tramos.

## 4. Representación confirmada — registro humano en §10

### 4.1. Hoja, patrón y ciclo

Decisión P1 confirmada: una hoja nueva representa la realización de un patrón durante **un ciclo**. `routeDate` se conserva como fecha de inicio del ciclo; `cycleLengthDays` es su duración explícita. No se crean hojas diarias duplicadas para cada actividad. La programación contiene el patrón fechado del ciclo y permite validar su repetibilidad sin generar el siguiente.

El identificador de hoja sigue siendo estable y conserva su tarifario propio. La relación de serie/renovación y materialización del segundo ciclo se implementarán en D-05; no reutilizar silenciosamente `cycle_number IN (1,2)` como contador histórico ilimitado. Hasta esa continuación no se declarará operativa la ventana móvil completa ni se usará el endpoint antiguo como prueba de elegibilidad. D-03 debe rechazar períodos incompatibles con registros actuales, sin series paralelas para evadir límites.

### 4.2. Persistencia propuesta

Representación definida para una **migración nueva**, implementada localmente en sección 1 tras la confirmación humana:

| Registro | Datos y restricciones previstas |
|---|---|
| Programación por hoja | routeSheetId único, cooperativeId, schemaVersion, revision, cycleStartDate, cycleLengthDays, auditoría; revisión 0 indica ausencia y primera escritura devuelve 1 |
| Servicios requeridos | UUID estable, hoja/tenant, frequencyId, departureAt; unicidad hoja/frecuencia/instante |
| Asignación SERVICE | Conservar route_sheet_assignments como identidad de asignación; extender con requiredServiceId, departureAt, arrivalAt, preparationMinutes; un servicio requerido tiene exactamente una asignación |
| Puntos del servicio | assignmentId, posición 0..N-1, locationKey y fechas operativas; orden y lugares derivados de Frecuencias, tiempos expresos del administrador |
| Actividades TRANSFER | UUID estable, hoja/tenant/bus, origen/destino, salida/llegada/preparación; sin frecuencia ni tarifa |
| Disponibilidad inicial | Una por hoja/bus: availableAt y locationKey; el servidor contrasta compromisos previos y posteriores |
| Bloqueos | UUID estable, hoja/tenant/bus, REST o MAINTENANCE, inicio/fin y motivo; sin generar descansos por conteos |

Persistencia relacional con referencias compuestas coherentes de hoja/tenant y validación de grupo; no FK a tablas de otros módulos ni SQL sobre Fleet/Frecuencias. PostgreSQL usa timestamptz; la salida usa ISO con offset (UTC Z válido). Fechas de ciclo se calculan en -05:00, no en zona del equipo. Enteros con validación segura y longitudes compatibles con restricciones existentes, sin límites operativos arbitrarios nuevos.

Los IDs de servicios/asignaciones/actividades/bloqueos son UUID estables proporcionados en el contrato de edición y validados por el servidor: nuevos IDs deben estar libres; existentes deben pertenecer a la misma hoja, tenant y clase. Una edición conserva la identidad de las filas retenidas. Cambiar la identidad comercial frecuencia/salida exige un nuevo servicio/asignación; no reciclar sus IDs. Retirar registros solo en DRAFT sin referencias comerciales; hojas publicadas son inmutables en este alcance.

### 4.3. Compatibilidad y tarifario

La migración agrega campos opcionales a datos antiguos, sin inventar tiempos, disponibilidad ni ciclos. Los nuevos registros programados exigen datos completos mediante restricciones y aplicación. Los índices únicos antiguos se reemplazan mediante migración nueva por restricciones compatibles: conservar unicidad del modo legado y exigir unicidad por salida en modo programado; nunca eliminar índices sin sustitución validada.

El conjunto distinto de frecuencias SERVICE es la fuente del tarifario de D-02; repetir una frecuencia en distintas fechas no exige matrices duplicadas. Guardar programación no modifica tarifas ni su revisión. Un cambio de conjunto/recorrido que desajuste la matriz bloquea publicar hasta reconfigurarla; cambiar solo bus u horas no cambia el precio congelado de otra hoja.

Una vez programada la hoja, los endpoints antiguos de agregar/quitar asignaciones, días de parada y generar ciclos deben rechazar cambios que omitan la validación integral. La adopción exige sustituir explícitamente las asignaciones/días de parada legados de un borrador, dentro de una transacción; nunca mantener dos fuentes de verdad. No inferir un intervalo de un día de parada sin fechas. Política de adopción/publicación antigua confirmada en P3; su conexión HTTP corresponde a sección 2.

## 5. Caso de uso y concurrencia propuestos

`saveRouteSheetProgramming({ routeSheetId, cooperativeId, modifiedBy, expectedRevision, programming })` recibe identidad verificada. `getRouteSheetProgramming({ routeSheetId, cooperativeId })` permite recuperar la revisión tras recargar la pantalla. Aplicación recibe puertos propios, nunca cliente pg.

1. Validar estructura/UUID/fechas/revisión; obtener hoja y grupo propios; exigir DRAFT.
2. Abrir transacción y tomar el lock transaccional de escrituras de Route Sheets antes de bloquear hojas/filas. La implementación local serializa globalmente escrituras del módulo, incluidos escritores legados, según ADR 0006; sacrifica paralelismo para evitar carreras de inserción y mantener orden compatible con publicación tarifaria.
3. Comparar revisión esperada; obtener frecuencias por API pública transaccional de ADR 0005 y buses por API pública de Fleet. Si un dato mutable de Fleet necesita protección hasta commit, acordar sesión/versionado con Edwin; no simular garantía ni consultar sus tablas desde Route Sheets.
4. Leer compromisos externos según P2/P3, incluidos preparación, bloqueos y vecinos anterior/posterior, aunque estén fuera del intervalo de la hoja. No validar continuidad solamente contra la ubicación declarada por el cliente.
5. Derivar recorrido autorizado y validar fechas de puntos, hora local de salida, agendas, cobertura y repetibilidad con validadores de D-01. La validación de un patrón completo se separa de la agenda real combinada con otras hojas: esta última no exige repetir las obligaciones ajenas.
6. Guardar todos los registros, auditoría y revisión incrementada una vez; commit o rollback completo. Nunca borrar primero y validar después fuera de la transacción.

Propuesta técnica de serialización: advisory locks transaccionales con claves de ámbito documentado dentro de Route Sheets; después bloqueo de filas. La sección 1 debe justificar y probar el protocolo, orden de adquisición y participación de todos los escritores, también la publicación. Una consulta previa sin bloqueo no prueba ausencia de conflictos.

Al publicar, programación, revisión de tarifa y frecuencias se revalidan bajo el mismo protocolo; congelación tarifaria y estado se confirman juntos, conservando idempotencia de D-02. `expectedProgrammingRevision` se propone opcional en publicación, análogo a `expectedRevision` del tarifario: si se envía se exige coincidencia; si no, se valida la revisión vigente bajo bloqueo. No confundir ambas revisiones.

## 6. Contratos HTTP propuestos

| Método | Ruta | Rol | Respuesta |
|---|---|---|---|
| PUT | /api/v1/route-sheets/:id/programming | COOPERATIVE_ADMIN + CSRF | 200, programación normalizada y revisión nueva |
| GET | /api/v1/route-sheets/:id/programming | COOPERATIVE_ADMIN | 200 con `{ programming: null, revision: 0 }` si hoja propia aún no programada |
| POST existente | /api/v1/route-sheets/:id/publish | COOPERATIVE_ADMIN + CSRF | Conserva `{ routeSheet }`; valida programación según P3 |

PUT contiene `{ expectedRevision, programming: { cycleStartDate, cycleLengthDays, requiredServices, agendas } }`. El contrato normalizado reutiliza los campos de ROUTE-SHEETS-04: cada agenda tiene busId, initialAvailability, activities y blocks; SERVICE añade `requiredServiceId` y `points`. HTTP no acepta cooperativeId, actor, status, readyAt ni metadatos derivados. El servidor añade contexto y obtiene ubicaciones SERVICE de Frecuencias. TRANSFER sí declara sus lugares explícitos. Rechazar campos adicionales, no permitir selección de tenant.

Contrato P4 confirmado para points: lista explícita por posición; origen tiene departureAt del servicio, destino arrivalAt del servicio y paradas intermedias arrivalAt/departureAt (igualdad permitida). Orden temporal no decreciente entre puntos, arrivalAt <= departureAt en parada y todo dentro del intervalo total; embarque intermedio toma departureAt. No inferir fechas por comparación de horas. No duplicar/fusionar posiciones con nombres iguales. Frecuencias actual devuelve lugares ordenados y hora de origen, sin horas de parada: estas son datos operativos expresos, no modificación de la frecuencia.

GET y PUT devuelven `{ routeSheetId, cooperativeId, revision, programming, updatedBy, updatedAt }`, con las identidades persistidas, puntos, fechas y lugares autorizados. Primera escritura exige expectedRevision 0; edición exige la revisión leída. PUT es reemplazo atómico con control de revisión, sin prometer que reintentar un body con revisión vieja sea exitoso: consultar GET tras respuesta incierta. No endpoint público de compra ni `tripQueries` en D-03.

Errores previstos: 400 estructura/UUID/fecha/revisión inválida; 401/403 autenticación/rol/CSRF; 404 hoja no encontrada o ajena sin distinguirla; 409 revisión desactualizada, publicada/no editable, conflicto de agenda/cobertura, adopción requerida, operación legada incompatible o datos legados no verificables; 503 proveedor ausente/fallo técnico. Reutilizar códigos existentes cuando coincidan semánticamente. Conflictos incluyen solo contexto autorizado y siguiente acción, sin datos de pasajeros ni información de otro tenant. Error técnico nunca significa bus libre.

## 7. Ejemplos y criterios de aceptación

Ejemplos ficticios, preparación explícita de 15 minutos únicamente en los ejemplos. Patrón de un día que empieza 2026-11-02: un bus disponible en Ambato realiza Ambato–Latacunga 07:00–08:00, Latacunga–Quito 08:15–10:00 y Quito–Ambato 10:15–13:00. Es válido si las tres frecuencias autorizan esas salidas, no existen compromisos ajenos y cierra la repetición. No deducirlo de tres frecuencias y un bus.

- [ ] Mismo bus realiza varios SERVICE compatibles; misma frecuencia puede repetirse en fechas distintas con asignaciones distintas.
- [ ] Salida siguiente 08:14, salida simultánea, ubicación incompatible sin TRANSFER o mantenimiento superpuesto: 409 y ningún cambio persistido.
- [ ] Servicio nocturno con llegada al día siguiente se recupera con fecha correcta; ciclo que corta llegada/preparación se rechaza.
- [ ] Cobertura faltante, salida requerida duplicada o servicio no requerido se rechazan.
- [ ] Repetibilidad comprueba ubicación final y preparación contra la primera actividad desplazada L días.
- [ ] Conflicto en otra hoja o con actividad vecina fuera del período se detecta según política confirmada.
- [ ] Dos escrituras de igual revisión producen un único éxito; asignación concurrente del mismo bus no deja compromisos incompatibles.
- [ ] Error durante guardado/publicación revierte programación, revisión, auditoría y congelación aplicables.
- [ ] Publicar exige matriz correcta para frecuencias distintas y programación validada; no publica programación incompleta ni tarifa ausente.
- [ ] Hoja ajena/rol no autorizado/CSRF inválido no cambia datos ni revela agenda ajena.
- [ ] IDs retenidos sobreviven a edición y GET; no se confunden frecuencia, servicio requerido, asignación y futuro viaje.
- [ ] No se pierden datos históricos ni se editan migraciones existentes; operaciones antiguas no eluden reglas nuevas.

## 8. Pruebas y migración

Sección 1: unitarias del caso de uso con puertos de contrato fiel; PostgreSQL aislado para migración, restricciones, rollback, identidad/revisión, carreras entre hojas y vecinos temporales. Cubrir upgrade desde datos legados reales mínimos, no solo base vacía. Revisar rollback de migración para no destruir datos programados silenciosamente; no ejecutar down sobre información comercial.

Sección 2: integración HTTP con autenticación/CSRF reales, tenant y revisión; guardado/lectura/publicación, reintentos, cambios de frecuencia/recorrido/tarifa, carreras PUT/publicación y bloqueo de rutas antiguas. Probar API pública real de proveedores disponibles; doble solo en unitarias. Dependencia externa pendiente se documenta y falla cerrado.

Por sección funcional ejecutar lint, format:check y npm test desde backend; [base aislada](../testing-database.md), sin leer .env. Si cambia composición, verificar arranque real. Conservar fallos anteriores y resultados reales, sin modificar pruebas para ocultar incompatibilidades. Revisar contrato antes de adaptar pruebas históricas legítimamente afectadas.

## 9. Tres secciones, un commit por sección

| Sección | Resultado / dependencia | Commit sugerido |
|---|---|---|
| 0 | Esta spec y estado; propuestas de §10 visibles, sin producto | docs(hojas-ruta): define la programación multifrecuencia persistida |
| 1 | Tras confirmar §10 y autorizar: persistencia/caso de uso completo, migración nueva y pruebas de concurrencia | feat(hojas-ruta): persiste la programación multifrecuencia del borrador |
| 2 | Tras autorizar: PUT/GET, integración con publicación y cierre de escritores legados, pruebas/arranque | feat(hojas-ruta): conecta la programación y valida su publicación |

Sección 1 no habilita una ruta productiva hasta sección 2. Cada commit funcional incluye evidencia y pruebas; no ejecutar commits por inferir autorización de implementar. No repetir D-01/D-02 ni ampliar a D-04/D-05.

## 10. Decisiones confirmadas y coordinación

El 2 de noviembre, tras solicitar sección 1, David respondió «Confirmo las cuatro propuestas» a la consulta conjunta P1–P4. Se registran como decisiones confirmadas por el solicitante, sin atribuir una respuesta individual nueva de Leslie o Edwin. La tabla conserva las alternativas evaluadas; sus recomendaciones quedan aceptadas. No equivale a revisión humana del código ni a autorización de sección 2.

| ID / participantes | Pregunta y alternativas | Recomendación e impacto |
|---|---|---|
| P1: David, Leslie | ¿Una hoja por ciclo multidiario o cabecera de patrón con hojas diarias hijas? | Una hoja por ciclo (§4.1), preservando identidad y tarifa propia. Cambia interpretación de routeDate y requiere relación de renovación en D-05. |
| P2: David, administrador operativo | ¿Un borrador guardado compromete al bus frente a otros borradores o solo lo publicado? | Todo borrador programado guardado y toda hoja publicada ocupan agenda; evitar guardar dos planes incompatibles. Elegir solo publicados permitiría planes alternativos y trasladaría el conflicto final a publicación. Definir liberación/retirada antes de necesitar cancelar borradores. |
| P3: David, Leslie | ¿Cómo publicar/adoptar hojas antiguas sin tiempos verificables? | Hojas publicadas legadas conservan lectura y snapshot, sin convertirlas en viajes nuevos; toda publicación nueva exige programación. Borrador legado se adopta por reemplazo explícito completo. Compromisos legados del bus con fechas potencialmente relevantes bloquean con error hasta regularizar, sin declararlos libres ni inventar horas. |
| P4: David, Leslie | ¿Contrato de paradas con llegada y salida expresas o un único instante? | Llegada/salida en cada parada (§6), permitiendo igualdad y cierre de venta en salida de la parada. Es necesario para no perder espera ni fecha al preparar D-04. |

Con Edwin: comprobar si los datos requeridos de bus/grupo son inmutables en operaciones actuales; si existe modificación concurrente, precisar lectura transaccional o revisión pública de Fleet. Inventario/versionado de asientos asociado a hoja sigue como contrato independiente requerido por D-04/Bookings; no se afirma implementado por busQueries ni seatQueries.

Con Leslie: confirmar que los IDs propuestos permiten persistir posteriormente reserva–viaje–hoja–asignación. Se mantienen las firmas de pasajeros de ROUTE-SHEETS-02 y estados RESERVED/SOLD, incluida revisión. Su proveedor y el viaje estable no se implementan aquí. No atribuir aceptación del mensaje previo de Leslie a esta representación nueva.

## 11. Calidad y defectos inducidos

Domain solo valida datos; application coordina puertos; infrastructure resuelve bloqueos/SQL de su módulo; HTTP traduce entradas/errores. Reutilizar validadores sin duplicar política ni importar capas ajenas. Puertos pequeños y dobles que propaguen errores; composición central y orden de locks explícito. No abstracciones para optimización futura.

Sin frontend: no aplica adopción de DESIGN.md ni se declara usabilidad visual comprobada. Contrato debe permitir recuperar revisión y mostrar actividad/fecha/motivo de conflicto sin datos ajenos. Dado un conflicto, cuando PUT falla, entonces la programación anterior sigue recuperable por GET y el error explica qué corregir. Pantalla y prueba de usuarios corresponden a tarea posterior.

No aplica defecto inducido. Respetar [protocolo](../errores-inducidos.md); ningún fallo de concurrencia, publicación o cobertura es un defecto académico autorizado.

## 12. Evidencia de sección 0 y siguiente paso

Se consultaron reglas, specs 04/05, arquitectura, convenciones, calidad, guía/equipo, ADR 0005, migración original, APIs públicas y validadores existentes. ROUTE-SHEETS-06 libre en archivos/referencias examinados; no se certifica ausencia de trabajo privado o remoto no actualizado. Cambios exclusivamente Markdown: esta spec, referencias relacionadas y fila propia de estado. No código, migraciones, dependencias, pruebas ejecutables nuevas ni algoritmo implementados.

Sección 0 preparada para revisión; §10 conserva propuestas pendientes, no acuerdo cerrado. Diff documental revisado y `git diff --check` aprobado; 63 enlaces locales comprobados sin destinos inexistentes en los cuatro documentos afectados (sin certificar anclas ni enlaces externos). No se ejecutan lint/Jest por este cambio documental ni se reutiliza evidencia histórica como prueba de D-03. Próximo paso: respuesta humana a P1–P4 y coordinación técnica de Fleet si corresponde; después solicitar sección 1. Revisión humana, commits, PR e integración de D-03 pendientes.

## 13. Sección 1 — implementación local y evidencia posterior

La sección 12 conserva la evidencia histórica de sección 0. David guardó esa sección en 2890d2b, solicitó implementar sección 1 y confirmó P1–P4. Posteriormente respondió «Sí, solo las listas de limpieza» para adaptar cuatro TRUNCATE existentes. No hubo comunicación directa con Edwin/Leslie ni aprobación individual de código por ellos.

### Resultado y contratos internos

`save-route-sheet-programming.use-case.js` recibe `{ routeSheetId, cooperativeId, modifiedBy, expectedRevision, programming }`. Contexto con UUID canónicos; revisión entera desde cero, campos explícitos/estrictos y copia normalizada sin mutar entrada. Los puntos SERVICE reciben lugares de la frecuencia y salida exacta a su hora autorizada, sin segundos/fracciones ocultos. Llegada/salida de paradas son expresas. Dominio valida ciclo, cobertura, agendas, continuidad, bloqueos y repetición; aplicación consulta puertos, dominio decide conflictos e identidades, infraestructura solo adapta/persiste.

`PgRouteSheetProgrammingRepository.withLockedProgramming(context, operation)` abre la transacción y ofrece sheet, revision, frequencyQueryPort, findCommitments, findIdentities y save; ningún ejecutor pg llega a application/domain. Ante hoja ajena/ausente devuelve ROUTE_SHEET_NOT_FOUND/404. Escritura solo DRAFT, fecha inicial igual a routeDate, revisión coincidente; devuelve programación persistida, auditoría y revisión incrementada. Edición con revisión vieja no sobrescribe. La revisión tarifaria es independiente.

La migración nueva `1793650000000-route-sheet-programming.js` crea siete tablas: cabecera, libro de identidades, servicios requeridos, disponibilidad inicial, puntos del servicio, traslados y bloqueos. Extiende asignaciones existentes con servicio/fechas/preparación. Sustituye índices históricos mediante índices parciales legados y unicidad por servicio/salida programados; FK compuestas evitan mezclar hoja/tenant. No cambia migraciones anteriores ni inventa tiempos de registros históricos.

El libro de identidades conserva IDs retirados; prohíbe cambiar hoja, tenant, clase o identidad frecuencia/salida comercial al reutilizarlos. Las filas retenidas conservan UUID; el reemplazo de hijos es transaccional, sin autorización para retirar referencias comerciales futuras (sus FK impedirían borrarlas). Auditoría conserva programación anterior/nueva y revisión. Una adopción legada usa nuevas identidades y reemplazo explícito completo, incluidos días de parada; no mantiene dos fuentes operativas. Down se rechaza si existen programaciones; no destruir información para restablecer índices antiguos.

### Concurrencia, proveedores y límites

Se implementa [ADR 0006](../adr/0006-serializacion-de-programacion.md): lock transaccional global del módulo antes de filas/frecuencias, compartido con la sesión de tarifario y con escritores legados mediante triggers BEFORE STATEMENT. Serializa también cooperativas distintas; es un coste conocido, sin prometer rendimiento no medido. Triggers bloquean cambios legados sobre hojas programadas, nuevas asignaciones/paradas legadas de buses programados y ciclos legados del grupo. La sección 2 traducirá esos errores defensivos a HTTP y conectará publicación con la programación; aún no hay ruta productiva nueva.

Se consultan compromisos de todas las hojas programadas de la cooperativa, incluso vecinos anteriores/posteriores fuera del intervalo candidato; no se filtran solamente por fecha de inicio. Se validan ciclos superpuestos y máximo de dos no terminados con reloj inyectable, además de la agenda combinada sin exigir repetición de obligaciones ajenas. Compromisos legados del mismo bus, sin duración conocida, fallan conservadoramente cerrado: no se presupone que un registro antiguo carezca de efectos. Ciclos legados potencialmente pertinentes también bloquean adopción. Relación de serie, generación/renovación y ventana móvil productiva siguen en D-05.

Frecuencias usa API pública transaccional real de ADR 0005. En Fleet se contrastaron index.js, bus-router y PgBusRepository: bus/cooperativa/grupo solo se crean y consultan en el código productivo examinado, sin edición de esos atributos. No se añade bloqueo/versionado ajeno inexistente, ni se afirma congelar inventario de asientos. Si aparece edición concurrente, revisar ese contrato antes de habilitarla.

### Pruebas y entorno

Nuevas pruebas unitarias cubren estructura/contexto, revisión, rol de estado, ausencia/fallos de proveedores, cobertura, preparación, medianoche, paradas, traslados y bloqueos. Integración usa APIs públicas reales de Fleet/Frecuencias y PostgreSQL: upgrade con asignaciones legadas, IDs, revisión, tenant, bus, frecuencias activas, concurrencia del mismo borrador y de dos hojas, vecino temporal, rollback tras insertar, protección de escrituras legadas y de down, dos ciclos, frecuencia repetida y conservación de tarifa.

Primera ejecución global: 1101 unitarias aprobadas; 249 integraciones aprobadas/41 fallidas por limpieza de cuatro suites, antes de autorizar su adaptación. Solo se añadieron las siete tablas nuevas a las listas TRUNCATE de frequencies/http.test.js, frequencies/pg-frequency.repository.test.js, frequencies/migration.test.js y route-sheets/route-sheet-routes.test.js. No cambios a escenarios, comprobaciones, timeouts ni pruebas omitidas. Corrigidos fallos iniciales de lint del incremento y preparación de la base efímera; no se debilitaron expectativas.

`npm ci` restauró versiones exactas del lock tras avisar/justificar; package.json y package-lock.json intactos. Node local 22.19.0 frente al engine 24 requerido. La imagen local permitió comprobar versión 24.21.0 sin código montado, pero revisión automática rechazó montar/copiar código y pasar credencial de pruebas a esa imagen no verificada; no se ejecutó la acción rechazada ni se certifica la suite en Node 24.

PostgreSQL efímero: docker-compose.test.yml con `--env-file NUL`, proyecto busesuta-programming-s1, PostgreSQL 16.13 y credenciales ficticias versionadas. No .env leído ni base de desarrollo utilizada. Sección 1 no cambia composición ni añade HTTP; la publicación tarifaria solo comparte el orden de lock, no incorpora anticipadamente sección 2. Recursos efímeros retirados al finalizar.

Verificación final del código revisado: `npm test` aprobado, **1103 unitarias y 297 integraciones (1400 pruebas)**; 64 suites unitarias y 25 de integración aprobadas. Incluye **57 pruebas nuevas** (35 unitarias y 22 integraciones), sin pruebas omitidas ni fallos inducidos. Comprobación dirigida adicional de programación aprobada; las suites existentes de tarifario/congelación también aprobaron. Las pruebas globales ejecutan el arranque real usado por las integraciones existentes, sin cambios de composición de este incremento.

Lint aprobado; Prettier de todos los JS cambiados/nuevos aprobado. `format:check` global mantiene 41 archivos previos pendientes, incluidas cuatro migraciones históricas preservadas. Diff completo revisado, `git diff --check` aprobado y 60 enlaces locales comprobados sin destinos inexistentes (sin certificar anclas/externos). Los dos casos de colisión de UUID entre cooperativas aprueban sin lecturas globales de identidades: las consultas filtran tenant y las restricciones únicas se traducen a un conflicto genérico con rollback. Pendiente independiente: repetir suite con runtime Node 24 controlado; no presentar el resultado en Node 22 como evidencia de Node 24.

Próxima sección autorizable: 2, después de revisar este incremento. Mensaje de commit sugerido: `feat(hojas-ruta): persiste la programación multifrecuencia del borrador`. Sin commit, PR, revisión humana de código o integración nueva ejecutados.
