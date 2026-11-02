# ROUTE-SHEETS-05: Tarifario congelado por hoja de ruta

## Corrección posterior: pruebas de publicación — 2 de noviembre de 2026

Petición humana expresa tras el reporte de Pablo sobre PR #42; rama separada `feature/ROUTE-SHEETS-05-corrige-pruebas-publicacion`, base local comprobada `7ef2f25`, inicialmente limpia, que contiene la integración del tarifario `1fb0ade`/PR #39. No se verificó el contenido remoto de PR #42. Esta evidencia posterior actualiza los pendientes históricos de las secciones inferiores.

Causa: las dos pruebas de `publish-route-sheet.use-case.test.js` seguían inyectando `routeSheetRepository`, mientras el caso de uso exige `tariffRepository.withLockedSheet`. La corrección autorizada adapta sus datos y dobles al contrato vigente: UUID válidos, tarifario explícito completo, frecuencia activa y congelación dentro de la operación transaccional. Se conserva el objetivo de publicar y se comprueban la identidad, el contexto de cooperativa, la consulta de frecuencia y una única congelación del snapshot. La ausencia de hoja conserva el error funcional `ROUTE_SHEET_NOT_FOUND`/404 y propaga la instancia `TariffNotFoundError` del puerto actual; no se sustituye por `TariffSourceError` ni por éxito.

No se cambia producción, migraciones, dependencias, timeouts ni reglas de negocio. Permanecen intactas las pruebas que rechazan publicar sin tarifa o sin proveedor; no hay fallback ni pruebas omitidas. Sin frontend ni defecto inducido. Alcance: una adaptación de contrato en pruebas, con esta evidencia y el registro compartido; D-03 sigue sin implementar.

Verificación: las dos pruebas corregidas y la suite de publicación/consulta congelada aprueban (31 pruebas). Lint aprobado; formato del archivo cambiado aprobado. Formato global falla en 41 archivos previos, incluidas cuatro migraciones que no se modifican. Node local 22.19.0 frente al engine 24 requerido. `npm test` inicial: 1019 aprobadas/3 fallidas por acceso HTTP local EACCES y una suite que no carga por busboy ausente. Repetición unitaria con acceso HTTP permitido: 1022 pruebas aprobadas, 61 suites aprobadas/una que no carga por busboy ausente; no se declara suite global aprobada.

Integración independiente: 179 pruebas aprobadas/una fallida, 15 suites aprobadas/8 fallidas; siete no cargan por busboy ausente y almacenamiento de fotos supera el timeout existente de 20 segundos. PostgreSQL aislado mediante `docker compose --env-file NUL -f docker-compose.test.yml -p busesuta-publish-fix up -d --wait`, con credenciales ficticias versionadas y recursos retirados al finalizar. No se leyó .env. Composición sin cambios: no requiere nuevo arranque por esta corrección de pruebas. Diff completo revisado y `git diff --check` aprobado. Pendientes: entorno/dependencias conforme al lock y Node requerido, revisión humana y PR; sin commit ni publicación ejecutados. Mensaje sugerido: `test(hojas-ruta): actualiza las pruebas de publicación con tarifa`.


- **Referencia de planificación:** D-02; referencia local, sin ticket externo.
- **Responsable:** David, conforme a distribución y tarea seleccionada por el solicitante.
- **Módulo:** route-sheets; FrequencyQueries como fuente de recorrido y Bookings como consumidor de política comercial.
- **Estado:** En desarrollo; sección 0 guardada en 7519854 y sección 1 en 4875147 por el humano. Sección 2 solicitada e implementada localmente; sin commit, revisión humana ni integración comprobados.
- **Fecha:** 1 de noviembre de 2026, America/Guayaquil.
- **Rama/base local:** feature/tarifario-hojas-ruta-spec, 8886553, árbol inicialmente limpio. PR #38 integra programación multifrecuencia. No se actualizó remoto en esta sesión.
- **ID:** ROUTE-SHEETS-05 libre entre specs examinadas; no es un ticket externo ni sustituye D-02 en el cronograma.
- **Revisor humano:** Leslie propuesta; aceptación de revisión de esta tarea pendiente. Edwin participa cuando se conecte la categoría real del asiento. No se les atribuye aprobación de las propuestas nuevas.
- **Autorización:** reglas y sección 1 confirmadas en §10; posteriormente solicitó sección 2 y confirmó expresamente las firmas de lectura de §13. No pidió ejecutar commits ni publicar cambios.

## 1. Objetivo y fuentes

Permitir al administrador configurar tarifas explícitas para cada combinación válida de recorrido y una política de VIP/beneficios para la hoja. Publicar la hoja debe conservar una copia comercial que no cambie por editar otras configuraciones. Evitar que reserva o pago tomen como autoridad precios del navegador.

Fuentes: [business-rules.md](../business-rules.md), [acuerdos §2](../acuerdos-primera-entrega.md), FREQ-01, ROUTE-SHEETS-01/04, BOOK-05, arquitectura, convenciones y calidad. Reglas RN-02, RN-20, RN-22, RN-30 y RN-43. La confirmación humana posterior de §10 resuelve límites, mayor beneficio y congelación al publicar; esta última se implementa localmente en sección 2, cuya evidencia está en §13.

## 2. Qué está confirmado y qué depende de otros

**Confirmado:** tarifa directa origen–destino; con paradas, precio independiente para todas las combinaciones hacia adelante. Porcentajes configurados por administrador de cooperativa. Recargo VIP antes del descuento. Menor de 18, desde 65 y discapacidad acreditada. USD y centavos exactos, redondeo de mitad hacia arriba una vez al final del cálculo por pasajero. La hoja establecida conserva su política; cambios ordinarios para una hoja posterior.

David configura/expone tarifa base y política; Leslie determina elegibilidad y calcula cotización del pasajero en Bookings. Payments usa importe confirmado en reserva; no recalcula. Fleet informa categoría física real; no fija el precio. Esta separación conserva las responsabilidades existentes y no asigna tareas nuevas a otros por silencio.

No es necesario esperar al código de E-02 para preparar/validar tarifas: VIP es un parámetro de la política. La conexión a compra de un asiento VIP real sí requiere inventario/categoría de Fleet. L-01 puede planificarse contra contrato acordado, pero no usar un doble como proveedor de producción. No se requiere finalizar D-03 para el tarifario de la hoja actual; al evolucionar programación se conservan los identificadores y snapshots del tarifario.

## 3. Brechas comprobadas en 8886553

- FREQ-01/createFrequency conserva `segment_prices` con exactamente `stops.length + 1` importes; son precios consecutivos, no matriz completa.
- PgFrequencyRepository persiste esos precios en frequency_segment_prices y los devuelve como números. No editar su migración ni convertir silenciosamente esos números en otra política.
- FrequencyQueries.findWithStops ya entrega recorrido con paradas, sin matriz tarifaria. Puede proveer el orden de lugares para esta tarea sin importar repositorios internos.
- PublishRouteSheet solo cambia estado y guarda la hoja; no congela tarifario ni valida cobertura comercial. La entidad actual no tiene política/versiones de tarifas.
- BOOK-05 conserva implementación histórica de suma de tramos y 50 %; su aviso documental exige adaptación posterior por Leslie. D-02 no refactoriza Bookings.
- No existe spec de tarifario previa en las rutas examinadas. No se afirma ausencia de trabajo privado o remoto posterior.

## 4. Modelo propuesto para el caso de uso

El contrato de configuración de sección 1 queda definido por implementación y confirmaciones de §10; consulta pública y congelación de sección 2 siguen pendientes de implementar. No se presenta la rama local como contrato integrado.

- Tarifa por hoja y frecuencia asignada. El recorrido `[origen, ...paradas, destino]` viene de la API pública de Frecuencias, aislada por cooperativeId. Cada posición tiene índice estable dentro de la copia del recorrido.
- Para N puntos se requieren N×(N−1)/2 precios, uno por par `(fromPosition, toPosition)` con `0 <= fromPosition < toPosition < N`. No aceptar inversos, duplicados ni huecos. Dos puntos requieren uno; tres requieren tres; cuatro requieren seis. No inferir precios ausentes sumando los vecinos.
- Ejemplo ficticio: Ambato–Latacunga USD 2,00; Latacunga–Quito USD 3,00; Ambato–Quito USD 4,50. Comprar Ambato–Quito usa 450 centavos, no 500.
- Entrada de importes en `amountCents`: enteros positivos hasta 9 999 999 999, equivalente al máximo histórico USD 99 999 999,99 confirmado. No flotantes USD, negativos ni conversión silenciosa de segment_prices.
- Política explícita en puntos básicos enteros: `vipSurchargeBps`, `minorDiscountBps`, `seniorDiscountBps`, `disabilityDiscountBps`, cada uno entre 0 y 10000 incluidos; 125 significa 1,25 %. Sin omisión/default a cero. Se guarda estrategia MAX_ELIGIBLE, esquema versión 1 y USD. Bookings aplicará VIP y luego el mayor descuento acreditado, con redondeo final; no calcula el cobro esta sección.
- El borrador mantiene revisión propia y recorrido copiado. Migración nueva 1793570000000 añade a route_sheets tariff_draft JSONB, tariff_revision, tariff_updated_by y tariff_updated_at, con consistencia de metadatos. No tabla adicional/FK nueva que obligue cambiar las limpiezas históricas de pruebas. La copia publicada independiente se implementará en sección 2.
- No se crea catálogo global de porcentajes en tenants sin spec propia. El administrador configura explícitamente la política de esta hoja; una política predeterminada por cooperativa sería una ampliación separada. Aplicación deriva cooperativa de identidad autenticada.

### Autoridad y publicación propuestas

1. Configurar tarifario únicamente en hoja DRAFT de la cooperativa autenticada, con rol COOPERATIVE_ADMIN y CSRF.
2. Obtener frecuencias/recorridos del servidor y validar matriz completa de las frecuencias asignadas. Cambiar asignaciones de borrador obliga a revisar cobertura antes de publicar; no basta que alguna versión anterior fuera válida.
3. Reemplazar el borrador completo con control de revisión esperada para evitar sobrescribir cambios de otro administrador. No permitir escribir estado PUBLISHED, versión congelada o precio de reserva desde el body.
4. Al publicar, verificar atomícamente hoja, revisión, cobertura, política y frecuencias vigentes; congelar la copia y publicar en la misma transacción. Si falla cualquier comprobación, no dejar hoja publicada sin tarifa ni copia parcial.
5. Publicar/reintentar no genera dos políticas ni cambia la versión de una publicación existente. Actualizar otra hoja/frecuencia no altera la copia establecida.
6. API pública de solo lectura para Bookings/Viajes devuelve únicamente el snapshot autorizado de hoja publicada y el precio del par solicitado. No fallback al precio consecutivo histórico, cero o borrador cuando falte una tarifa.

La publicación como instante de congelación fue confirmada en §10 e implementada localmente en sección 2 (§13); la evidencia histórica de sección 1 no certifica por sí sola esta transición.

## 5. Fronteras y alcance

**Incluye como plan:** configuración de tarifario completo de una hoja en borrador, validación de matriz/política, persistencia y revisión, copia congelada asociada a publicación y contrato público de lectura. Cada sección entrega un comportamiento completo pequeño, con pruebas y evidencia.

**Fuera:** cálculo final de descuento por pasajero y acreditación (Leslie), categoría real del asiento (Edwin), catálogo de viajes/búsqueda, pagos, sustituciones, editar frecuencias inmutables, redefinir ciclos, frontend o configuración global institucional. No rol Chofer/Controlador, no Wallet. No modificar pruebas históricas para ocultar incompatibilidades.

API entre módulos solo por index.js y puertos del consumidor. Application no depende de Express/pg ni infraestructura concreta. La transacción se implementa mediante un puerto del módulo, no importando tablas/repositorios de Frecuencias/Bookings. Coordinar cambios compartidos de composición si se necesitan y verificar arranque real en ese caso.

## 6. Endpoint y consulta propuestos

| Operación | Contrato propuesto | Condiciones |
|---|---|---|
| Configurar/reemplazar borrador | PUT /api/v1/route-sheets/:id/tariff | Implementado localmente: COOPERATIVE_ADMIN, CSRF, tenant autenticado, expectedRevision, matriz y política explícitas; salida 200 con revisión persistida |
| Publicar hoja existente | Ruta de publicación ya existente, sin crear otra | Conservar contrato HTTP acordado; añadir congelación atómica después de resolver §10 |
| Leer snapshot para otro módulo | routeSheets.tariffQueries, firmas confirmadas por el solicitante en §13 | Solo lectura autorizada, no endpoint público de matrices internas; ausencia distinta de error técnico |

Errores a concretar en código: entrada/matriz/política inválida (400), hoja ajena/no encontrada según convención del módulo, estado/revisión desactualizada o cobertura comercial incompleta (409). Proveedor fallido no equivale a lista vacía ni a tarifa gratuita. No fijar en la spec una firma no acordada con el consumidor como si ya estuviera aceptada.

## 7. Tres secciones, un commit por sección

Cada sección incluye toda su evidencia y, cuando corresponda, código y pruebas en un único commit lógico. Ejecutar commits requiere petición humana separada. No se implementan las siguientes secciones por completar este documento.

| Sección | Resultado y alcance | Commit único sugerido | Estado |
|---|---|---|---|
| **0 — Especificación y dependencias** | Esta spec, brechas comprobadas, propuestas/pendientes, criterios y actualización del registro | `docs(hojas-ruta): define el tarifario congelado por hoja` | Guardada por el humano en 7519854 |
| **1 — Configurar tarifario de borrador** | Un caso de uso/endpoint PUT: matriz y política explícitas, validación de dominio, persistencia mediante migración nueva, revisión esperada y aislamiento. Pruebas unitarias y PostgreSQL/HTTP del mismo comportamiento | `feat(hojas-ruta): configura el tarifario de una hoja en borrador` | Guardada en 4875147; revisión humana pendiente |
| **2 — Congelar al publicar y exponer lectura** | Extender el único caso de publicación existente con copia atómica, protección ante cambios concurrentes y consulta pública de snapshot/precio. Pruebas de conservación, rollback e idempotencia | `feat(hojas-ruta): congela el tarifario al publicar la hoja` | Implementada localmente, contrato confirmado por solicitante; sin commit ni integración |

La sección 1 no es un módulo completo ni una pantalla. Si al resolver el esquema se detecta que requiere más de un comportamiento independiente, presentar una división antes de implementarla, conservando un commit por sección acordada. No dejar pruebas para un commit posterior.

## 8. Criterios de aceptación previstos

- [x] Una frecuencia directa exige exactamente un precio; N puntos exigen todas sus combinaciones hacia adelante.
- [x] Matriz con par repetido, ausente, inverso, fuera de recorrido, importe inválido o frecuencia ajena no se guarda.
- [x] El recorrido autorizado proviene de Frecuencias; no se acepta cooperativa/recorrido del navegador como autoridad.
- [x] Configurar solo modifica la hoja borrador indicada; rechaza hoja publicada o edición concurrente sin revisión vigente.
- [x] Porcentajes cumplen unidad/límites aprobados, sin defaults silenciosos, y el contrato permite VIP antes del beneficio en Bookings. Cálculo final pendiente de L-01.
- [x] Publicar produce hoja y copia comercial coherentes en una transacción; fallo revierte ambas operaciones.
- [x] Cambiar configuración de otra hoja o fuente posterior no altera la copia ya publicada.
- [x] Leer par inexistente o snapshot no publicado no devuelve cero ni suma de tramos como fallback.
- [x] PUT de configuración protege autenticación, rol, CSRF y aislamiento. Consulta de sección 2 aislada por cooperativa verificada por el consumidor; no autentica peticiones HTTP por sí sola.
- [ ] No modificar pruebas antiguas para hacerlas pasar ni presentar una política propuesta como aprobada.

## 9. Verificación, calidad y usabilidad

Sección 0: diff y referencias locales, sin pruebas de producto porque solo cambia Markdown. Secciones 1/2: lint, format:check y npm test desde backend, PostgreSQL aislado según testing-database.md. Probar creación/actualización, duplicados, rollback, publicación concurrente con edición, lectura aislada y ausencia/fallo de proveedores. Si cambia composición, arranque real además de app montada.

SOLID: validadores de matriz/política en domain, un caso de uso por acción, puertos pequeños y copia comercial independiente de fuentes mutables. Evitar duplicar el cálculo de elegibilidad de Bookings. No introducir dependencias sin anunciar/justificar. Sin frontend: no se acredita usabilidad visual; los errores deben identificar par/campo inválido sin datos de otra cooperativa. La futura pantalla tendrá su spec y aplicación declarada de frontend/DESIGN.md.

Defecto inducido: no aplica; seguir errores-inducidos.md y no corregir defectos ajenos incidentalmente. Las pruebas históricas de ROUTE-SHEETS-04 no acreditan D-02. Fallos globales del entorno deben reportarse de nuevo con evidencia al implementar, no copiar resultados anteriores como actuales.

## 10. Decisiones de sección 1 confirmadas por el solicitante

El solicitante respondió expresamente a las tres preguntas presentadas: «Confirmo esas reglas», «Sí, esos límites» y «Conservar el máximo actual». Fuente: respuestas humanas del chat, 1 de noviembre de 2026. No son respuestas individuales nuevas de Leslie/Edwin ni aprobación del código. Queda confirmado:

1. **Beneficios simultáneos:** un único descuento, el mayor acreditado, sin acumular. En un empate el importe es el mismo; la etiqueta/categoría del desglose se precisará con Leslie en L-01, sin bloquear almacenamiento de esta política.
2. **Congelación:** al publicar por COOPERATIVE_ADMIN; DRAFT admite correcciones, publicado no. Transición/copia todavía pendiente de sección 2.
3. **Porcentajes:** de 0 a 100 % tanto para descuentos como recargo VIP, hasta dos decimales porcentuales; almacenamiento/intercambio en puntos básicos enteros (1 % = 100), cero solo explícito. Límites del proyecto académico, sin certificación legal implícita.
4. **Renovación:** copiar versión anterior a un borrador editable y congelar nueva versión al confirmar la nueva hoja; mantener intactas hojas ya publicadas. Renovación/copia efectiva sigue en tarea correspondiente.
5. **Importes/compatibilidad:** conservar máximo técnico USD 99 999 999,99 y exigir captura explícita de matriz completa, sin derivar combinaciones ni alterar precios de la frecuencia original.
6. **Contrato de lectura:** el solicitante confirmó posteriormente las firmas de §13, con null para ausencia y propagación de fallos técnicos. Bookings conserva elegibilidad y cálculo; no se cambió su código/pruebas ni se atribuye una respuesta individual nueva de Leslie.

Puntos 1–6 y autorización de sección 2 confirmados por el solicitante; revisión humana de código e integración real con Bookings siguen pendientes.

## 11. Evidencia de sección 0 y siguiente paso

Sección 0 completada: spec y enlaces en acuerdos, FREQ-01, BOOK-05 y estado. `git diff --check` aprobado y 52 referencias locales comprobadas sin destinos inexistentes (sin validar enlaces externos/anclas). Diff revisado: cuatro documentos existentes modificados y esta spec nueva. Solo documentación; no código, migraciones, pruebas funcionales, commits ni PR ejecutados. Revisión humana/integración pendientes.

El párrafo anterior conserva evidencia histórica de sección 0. El humano la guardó en 7519854; después confirmó reglas y solicitó sección 1, cuya evidencia se registra abajo.

## 12. Sección 1: contrato implementado y verificación

Se agrega migración nueva, dominio de matriz/política, puerto transaccional, repositorio PostgreSQL, caso de uso, controlador y PUT autenticado. Composición conecta FrequencyQueryAdapter existente sin importar capas internas de Frecuencias. No nuevas dependencias ni cambios a migraciones/pruebas anteriores. La ruta modificada se formatea junto con su cambio; no se formatean archivos ajenos.

Body estricto: `{ expectedRevision, policy: { vipSurchargeBps, minorDiscountBps, seniorDiscountBps, disabilityDiscountBps }, frequencies: [{ frequencyId, prices: [{ fromPosition, toPosition, amountCents }] }] }`. UUID de hoja en URL; cooperativa/actor de sesión, nunca body. expectedRevision=0 para primera configuración, luego revisión devuelta; máximo técnico 2147483646 antes de incrementar INTEGER. Rechaza campos extra, precios faltantes/duplicados e identidades inconsistentes antes de guardar. La matriz debe corresponder exactamente a las frecuencias asignadas; todas deben estar activas y pertenecer a la cooperativa.

Respuesta 200 `{ tariff: { routeSheetId, cooperativeId, busGroupId, revision, tariff, updatedBy, updatedAt } }`. El snapshot incluye schemaVersion=1, USD, política MAX_ELIGIBLE, frecuencia, recorrido copiado y precios ordenados. No calcula descuentos ni cobra. Reintentar con revisión vieja responde 409 y no genera escritura adicional. La futura consulta autorizada de borrador/recuperación de revisión se delimitará antes de integrar la pantalla; esta sección solo expone PUT y su revisión resultante.

Transacción: SELECT de hoja por id/tenant FOR UPDATE; lectura de asignaciones FOR SHARE; llamada a proveedor público; validación y UPDATE de datos/revisión/auditoría; COMMIT. Publicación/otra edición de fila serializan con ese bloqueo, y una segunda edición con revisión vieja falla. Cambios posteriores a asignaciones o frecuencia obligarán a revalidar al publicar en sección 2; la matriz no prueba vigencia indefinida de esas fuentes. Rollback ante error sin datos parciales; no se escribe ninguna tabla ajena.

Errores: ROUTE_TARIFF_INVALID 400, ROUTE_SHEET_NOT_FOUND 404 (también hoja ajena), conflictos de revisión/estado/cobertura/frecuencia 409; contrato inconsistente del proveedor ROUTE_TARIFF_SOURCE_UNAVAILABLE 503. Fallo técnico se propaga al middleware común; no se convierte en tarifa cero. No se expone SQL, credenciales ni datos personales.

**Verificación dirigida:** 53 unitarias nuevas y 14 integraciones PostgreSQL/HTTP nuevas aprobadas. Las integraciones usan autenticación/cookies/CSRF y Frecuencias reales; Fleet no es necesario para este caso de uso y no se simula un inventario de compra. Fixtures de bus/asignación son UUID de prueba conforme al esquema existente. Se verifica reemplazo, revisión creciente, carrera de dos PUT, prohibición de edición publicada, tenant/rol/CSRF, cuerpo estricto, fallo del proveedor y rollback posterior al UPDATE.

Lint aprobado; formato individual de los archivos cambiados aprobado, global fallido en 42 archivos previos ajenos. npm test: **993 pruebas aprobadas, 60 suites aprobadas/1 fallida** por busboy ausente en Fleet, sin alcanzar integración. Integración invocada por separado: **165 pruebas aprobadas/1 fallida, 14 suites aprobadas/8 fallidas**; siete suites no cargan por busboy y una supera el timeout existente de fotografías. No se redujeron expectativas ni se cambió el timeout.

El entorno usa Node 22.19.0 (el proyecto declara Node 24), PostgreSQL 16.13 aislado en proyecto busesuta-tariff-s1, Compose con --env-file NUL y credenciales ficticias versionadas; recursos retirados al terminar. Arranque de server.js intentado con configuración de pruebas: no llega a iniciar porque Fleet requiere busboy ausente en node_modules. No se le atribuye al tarifario ni se presenta el servidor completo como verificado. Sin .env de desarrollo, instalación de dependencias ni commit. Diff revisado y sin errores de espacios; SOLID comprobado localmente: domain sin adaptadores/Express/pg, application solo puertos/dominio, controlador solo traducción y repositorio dueño de transacción del módulo. Revisión humana, entorno Node 24/dependencias completas y sección 2 pendientes.

## 13. Sección 2: congelación y contrato de consulta

La evidencia de §12 es histórica de sección 1. Base de esta sección: 4875147, rama feature/tarifario-hojas-ruta-spec inicialmente limpia. El solicitante pidió implementar sección 2 y respondió «Confirmo el contrato propuesto» a las dos firmas siguientes. Se registra su confirmación real; no una respuesta individual nueva de Leslie ni aprobación de código. Sin commits, publicación ni integración ejecutados por el asistente.

### Publicación atómica y compatibilidad

Se conserva POST /api/v1/route-sheets/:id/publish y su respuesta `{ routeSheet }`. Se admite `expectedRevision` entero positivo opcional: si se envía debe coincidir con revisión vigente o congelada en un reintento; si se omite se toma la revisión actual bajo bloqueo, conservando la forma previa de la petición. Para pantallas que mostraron una revisión concreta, enviar ese valor para no confirmar una edición posterior inadvertida. No se permite suplir tarifa ausente ni reconstruir un snapshot histórico automáticamente.

Con hoja DRAFT bloqueada FOR UPDATE, se comprueban revisión, matriz completa, asignaciones actuales, política y recorrido autorizado; una parada/recorrido diferente exige reconfigurar, no reinterpretar índices de una tarifa antigua. Estado PUBLISHED, publishedBy/At y snapshot/versionado congelados se escriben en un único UPDATE dentro de la transacción. Error antes de commit revierte ambos. Reintento de hoja publicada con snapshot válido devuelve el mismo estado, actor, fecha y revisión, sin consultar fuentes mutables ni generar otra copia. Hoja histórica publicada sin snapshot responde ROUTE_TARIFF_FROZEN_MISSING (409), no toma el borrador actual como historia de una venta.

Migration nueva 1793570001000 añade tariff_frozen JSONB, tariff_frozen_revision, tariff_frozen_at y tariff_frozen_by. No edita migraciones anteriores ni rellena tarifas inventadas. Restricción asegura metadatos completos y estado publicado al existir snapshot; trigger impide alterar/borrar sus campos después de congelarlo. Borrador y copia son independientes: cambios de otra hoja/fuente no afectan a la publicada. Una reversión de migración elimina expresamente trigger/función/columnas en su down.

Frecuencias amplía su API pública con `frequencyQueries.forTransaction(executor)`, llamada exclusivamente desde infraestructura/composición. La sesión obtiene recorrido mediante repositorio de Frecuencias y bloquea la frecuencia FOR SHARE en la misma transacción; no hay SQL de otro módulo en Route Sheets. Esto impide una desactivación concurrente entre validación y commit. La inmutabilidad previa de paradas de FREQ-01 sigue vigente. Domain/application reciben solo datos y el puerto, nunca pg ni ejecutor. Detalle y alternativas: [ADR 0005](../adr/0005-lecturas-publicas-en-transaccion.md), propuesta técnica aplicada localmente y pendiente de revisión humana.

### Consulta confirmada

- `routeSheets.tariffQueries.findPublishedByRouteSheetId(routeSheetId, cooperativeId)` devuelve `{ routeSheetId, cooperativeId, busGroupId, revision, publishedAt, tariff }` inmutable. tariff incluye versión de esquema, USD, política y matriz/recorrido copiados.
- `routeSheets.tariffQueries.findPrice({ routeSheetId, cooperativeId, frequencyId, fromPosition, toPosition })` devuelve contexto de hoja/grupo/frecuencia, posiciones, revisión, USD, amountCents y política congelada; no calcula elegibilidad ni total final del pasajero.
- Cooperativa procede del contexto verificado de la aplicación consumidora, nunca del body del comprador como autoridad. La consulta filtra por hoja/tenant/estado PUBLISHED y snapshot existente. No es una autenticación HTTP autónoma ni una consulta global de matrices entre cooperativas.
- Null significa que no existe una copia publicada autorizada o el par/frecuencia no está en ella. Posiciones/UUID inválidos generan error de dominio; conexión fallida o snapshot corrupto propagan error, nunca null, cero o suma de tramos como fallback. Un snapshot completo se restaura/valida a partir de sus propios datos, sin depender de precios actuales de Frecuencias.
- No se agregó endpoint HTTP de matrices ni se cambió Bookings. La integración de Leslie/L-01 y viajes debe usar esta API y validar identidad del viaje, categoría de asiento y acreditación. Función disponible en rama no equivale a compra productiva conectada.

### Pruebas y límites de revisión

29 unitarias nuevas del flujo de publicación/lectura y 14 integraciones nuevas aprobadas. Junto a sección 1: 82 unitarias dirigidas y 28 integraciones de tarifario/publicación. Fixtures con autenticación/cookies/CSRF reales, PostgreSQL aislado y consulta pública real de Frecuencias; sin inventario de asientos simulado como producción. Se cubren cobertura/recorrido modificados, revisión desactualizada, dos publicaciones simultáneas idempotentes, carrera PUT/publicación, rollback tras congelar, inmutabilidad SQL y bloqueo de desactivación de frecuencia hasta cerrar publicación.

Lint y formato de archivos cambiados aprobados; formato global falla en 41 archivos previos ajenos al incremento (controlador modificado formateado). npm test sigue fallido: busboy ausente en Fleet y dos pruebas históricas de publish-route-sheet.use-case.test.js que inyectan el puerto anterior; una esperaba publicar sin tarifa. Repetición unitaria final: 1020 aprobadas/2 fallidas, 60 suites aprobadas/2 fallidas. Se conservaron sin modificar/debilitar y no se agregó fallback de publicación sin tarifa para satisfacerlas. Requieren revisión y adaptación autorizada a las nuevas reglas/puerto antes de integrar; no son defectos inducidos. Comprobación final dirigida de secciones 1/2: 110 pruebas aprobadas en cinco suites.

Integración independiente ejecutada en PostgreSQL efímero busesuta-tariff-s2 con --env-file NUL y credenciales ficticias: 15 suites aprobadas/8 fallidas, 179 pruebas aprobadas/1 fallida; siete suites no cargan por busboy y una supera timeout de fotografías existente (20 s). Arranque real de server.js intentado, bloqueado por busboy ausente al cargar Fleet. Node local 22.19.0 frente a engine 24 requerido; no se certifica el arranque completo ni ese entorno requerido. Sin instalación/actualización de dependencias ni cambios a timeouts/pruebas previas. Recursos de prueba retirados al terminar; revisión de diff y evidencia final al cerrar.

Próxima acción: revisión humana, resolver incompatibilidad de pruebas antiguas y entorno Node/dependencias antes de integrar. Secciones 0–2 preparadas/implementadas no equivalen a compra completa ni autorización automática para nuevas tareas de viajes/reservas. Un único commit lógico sugerido para sección 2: `feat(hojas-ruta): congela el tarifario al publicar la hoja`.
