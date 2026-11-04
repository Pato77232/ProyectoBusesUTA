# ROUTE-SHEETS-08: Renovación explícita de ciclos

- **ID local:** ROUTE-SHEETS-08, sin ticket externo. Gestor externo pendiente para después de la primera revisión.
- **Referencia de planificación:** D-05, primera tarea: renovación. Paradas operativas y sustitución tendrán specs separadas; no se les asigna un ID definitivo aquí.
- **Módulo / responsable:** `route-sheets` / David, por solicitud expresa en esta sesión.
- **Revisora propuesta:** Leslie. Su respuesta permite continuar la preparación de renovación; no confirma aceptación de revisar código ni aprobación de esta spec completa.
- **Estado:** Borrador; sección 0 documental preparada. Secciones funcionales pendientes de resolver las preguntas propias y de autorización de David.
- **Fecha:** 3 de noviembre de 2026, America/Guayaquil.
- **Rama / base comprobada:** `feature/ROUTE-SHEETS-08-renovacion-ciclos`, ya existente en `072f845`, inicialmente limpia. Se reutiliza sin merge/rebase. Fetch comprobó `origin/develop` en `4bb6861`, que incorpora FLEET-09 T1. La base de implementación deberá contrastarse con ese avance; esta sección no acredita la combinación ni modifica la historia Git.
- **Autorización:** David pidió realizar únicamente la sección 0 y aportó la respuesta de Leslie. Autoriza planificación, registro del acuerdo y seguimiento; no código, migraciones, commits, publicación ni cambios en Bookings/Fleet.

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

Es una propuesta de concreción del contrato; Q1–Q4 de §10 deben resolverse antes de implementar lo dependiente. No se presume aceptación de Leslie de estos detalles.

## 5. Datos y persistencia propuestos

Entrada conceptual: hoja origen (UUID en ruta), revisiones esperadas de programación y tarifa congelada y clave de solicitud para idempotencia. Tenant/autor vienen de sesión; tiempo del reloj del servidor inyectable en pruebas. Campos definitivos y alcance de la clave se cierran en Q2/Q3.

Salida propuesta: ID del nuevo borrador, ID de origen, serie vinculada, inicio/fin exclusivo, duración y revisiones propias. La respuesta indica DRAFT y no presenta viajes vendibles ni un horizonte ampliado. Una repetición idéntica devuelve el mismo destino; reutilizar la clave con otra operación produce conflicto.

Persistencia conceptual propia de Route Sheets: relación origen/destino/serie, revisiones de origen, clave, actor y fecha. Se definirán tabla/columnas y migración nueva solo al autorizar implementación; no modificar migraciones integradas ni acceder por SQL a tablas de otros módulos. Debe poder comprobarse unicidad y procedencia sin inferirlas por fechas.

## 6. Contrato HTTP candidato

No hay endpoint nuevo implementado. Propuesta: `POST /api/v1/route-sheets/:id/renewals`, COOPERATIVE_ADMIN con CSRF, donde `:id` identifica el origen propio. La ruta/payload se aprueban con la spec antes de código.

Resultados previstos: 201 al preparar, 200 al recuperar el mismo resultado; 400 entrada inválida; 401/403 sesión/rol; 404 origen ausente o ajeno sin revelar otro tenant; 409 revisión, origen no elegible, agenda, continuidad, cupo o solicitud incompatibles; 503 proveedor necesario ausente/fallido. Códigos concretos y traducción deben respetar los errores existentes y definirse con el caso de uso. Un fallo técnico nunca equivale a hoja libre ni a renovación realizada.

## 7. Criterios de aceptación pendientes

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

Origen legado sin programación o copia tarifaria verificable: conflicto, sin reconstrucción ficticia. La serie agotada y el siguiente período completamente pasado necesitan una política explícita (Q4); no saltar fechas silenciosamente. La fecha/hora exacta de límite se prueba con reloj inyectable.

Descanso/mantenimiento copiados mantienen su significado; no se convierten en disponibilidad de respaldo. Un bus que ya no sirve para la nueva programación bloquea la validación; sustituirlo en viajes vendidos corresponde a otra spec.

Los borradores programados ya consumen cupo en el validador de compromisos actual: permitir preparar un tercero exige decidir Q1, no debilitar pruebas o confundir ese conteo con el máximo comercial de publicados.

## 9. Verificación prevista de secciones funcionales

- Unitarias: copia y desplazamiento del patrón completo, identidades nuevas, revisiones, límites exactos de ciclo y semántica de idempotencia/origen.
- PostgreSQL aislado: alta del borrador íntegro, rollback, aislamiento, simultaneidad de preparar/publicar, conservación de historia y lectura posterior desde APIs reales.
- Contrato: borrador sin viajes/horizonte nuevo; publicación con nueva copia comercial y viaje, manteniendo las referencias ya consumidas por Bookings. Fallos reales de proveedores se propagan.
- Lint, `format:check` y `npm test` desde backend según [testing-database.md](../testing-database.md), sin leer `.env`; arranque real si cambia composición. Registrar resultados reales, incluidos fallos previos, sin ampliar timeouts para ocultarlos.

## 10. Decisiones propias y coordinación con Leslie

### Preguntas de renovación antes de implementar

| ID | Pregunta | Propuesta para revisión / impacto |
|---|---|---|
| Q1 | ¿Se prepara un tercer borrador mientras hay dos ciclos no terminados? | Para el primer incremento, conservar el conteo conservador de programación y preparar cuando haya cupo. Permitir un borrador adicional requeriría un cambio explícito y pruebas del validador de compromisos. No cambiar el límite comercial de dos publicados. |
| Q2 | ¿Desde qué hoja se copia y cómo se modifica el destino? | Recomiendo únicamente último ciclo publicado de la serie, copia íntegra con tarifa congelada como nuevo borrador editable y edición por los casos de uso existentes. Rechazar origen legado/incompleto en lugar de copiar parcialmente. |
| Q3 | ¿Cómo se identifica un reintento y se vincula la publicación? | Recomiendo clave de solicitud y vínculo persistido origen/destino/serie con unicidad del siguiente período; publicación deriva/contrasta ese vínculo. Definir campos/revisiones y resultado de otra clave para el mismo destino antes de persistencia. |
| Q4 | ¿Qué hacer si la serie terminó y su siguiente intervalo ya pasó? | Recomiendo rechazar la renovación automática de intervalos históricos y usar una nueva base manual validada; confirmar antes de implementar. No inventar saltos hasta hoy ni recrear viajes históricos. |

Las recomendaciones anteriores no están aprobadas por el mensaje de Leslie. David puede decidir los detalles de su módulo dentro del contrato; cambios a reglas compartidas se consultan según [el protocolo](../equipo-y-acuerdos.md).

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
| 1 | Tras resolver Q1–Q4: transformación y contrato de renovación, puertos/errores e idempotencia definidos, pruebas de dominio. | Pendiente de autorización; no producto en esta sección 0. |
| 2 | Caso de uso de preparación persistida y endpoint, vínculo con publicación y pruebas reales de concurrencia/rollback/arranque. | Pendiente; revisar si requiere dividir el incremento antes de autorizarlo. Coordinar composición, migraciones/catálogo, pruebas y registro. |

Una sección funcional reúne código, pruebas y evidencia en un cambio lógico; commits solo por petición humana. Esta planificación no concede autorización para las secciones siguientes.

Evidencia de sección 0: rama inicialmente limpia en `072f845`, `origin/develop` comprobado en `4bb6861`; inspección de `plan-commercial-cycle`, `validate-programming-commitments`, publicación, DTO por tramo y ADR. Diff documental revisado y `git diff --check` aprobado; 162 referencias locales de los cinco documentos comprobadas sin destinos inexistentes (no se verifican URLs externas ni anclas). También se comprueba el archivo nuevo sin espacios finales/conflictos. No se ejecutan lint/Jest/arranque porque solo cambia Markdown; sin pruebas de producto, migraciones ni nueva integración acreditadas. Asistencia de Codex en planificación/documentación.

## 14. Revisión y siguiente paso

Sección 0 preparada para revisión humana de David y consulta a Leslie según alcance. Resolver Q1–Q4 y confirmar revisora antes de la implementación dependiente; actualización de base y autorización de sección 1 pendientes. Las respuestas de Leslie no autorizan cambios de su módulo ni sustitución. No hay PR nueva, integración ni cierre de tarea acreditados.
