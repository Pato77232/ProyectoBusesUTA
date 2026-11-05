# SEARCH-01: búsqueda pública de viajes comercializables

Propuesta concreta para la petición de Edwin de completar la entrega el 4 de noviembre de 2026. ID local, no ticket externo. Sin implementación ni aprobación técnica individual de David/Leslie inferida. Requiere confirmar este contrato antes de producto.

Edwin confirma «Apruebo los tres contratos» el 4 de noviembre, incluidos SEARCH-01, BOLETOS-01 y AUTH-CORREO-01. Se autoriza implementar por incrementos; revisión humana de código pendiente. Base local: cadena de INTEG-01, Fleet-08, SMTP y formato publicados, aún no integrada en develop.

GET `/api/v1/trips?origin=Loja&destination=Ambato&date=2026-11-04`, público y solo lectura. Origen/destino por nombre normalizado exacto; date es la fecha local de embarque en America/Guayaquil, no necesariamente la salida del origen del recorrido. Incluye embarques en paradas. No aceptar tenant, precio ni reloj del cliente. Solo devolver viajes publicados y todavía comercializables según el contrato real de Route Sheets, con precio explícito por par, moneda USD y asientos ofrecidos del inventario congelado. Sin sumar precios consecutivos ni publicar hojas antiguas incompletas.

Search consume la API pública de Route Sheets y el nombre público de cooperativa por API de Tenants, sin SQL ajeno. Route Sheets resuelve candidatos desde sus tablas y revalida cada viaje mediante su consulta comercial. Respuesta: trips [{tripId,cooperativeId,cooperativeName,fromPosition,toPosition,boardingAt,arrivalAt,origin,destination,currency,amountCents}]. La búsqueda no promete ocupación libre; Bookings comprueba disponibilidad por viaje/tramo al seleccionar. Orden por embarque y luego identidad; límite de resultados acotado con aviso explícito de truncamiento, nunca inventar viajes. Fuente caída no equivale a lista vacía: 503; formato inválido 400; búsqueda válida sin resultados 200/[]; sin PII de compradores/pasajeros.

Pantalla pública de búsqueda y enlace a reservas con viaje y posiciones. DESIGN.md: marca/tokens/Bootstrap existentes, campos etiquetados, mensajes de carga/vacío/error, teclado/foco y móvil. No reserva al pulsar buscar. La pantalla explica precio base y que el resumen autorizado aplica VIP/descuentos.

Pruebas: embarque en parada/cambio de día, viaje ya cerrado, frecuencia inactiva, períodos confirmados, precio no aditivo, fuente averiada, ausencia de PII, enlaces correctos y reflujo. Una tarea API y otra pantalla, commits separados, pruebas PostgreSQL aislado/arranque real/lint/formato. No dependencias nuevas ni migraciones necesarias salvo evidencia contraria.

## Evidencia local de API y formulario, 4 de noviembre

API pública compuesta en servidor: Search consume fábricas públicas de Route Sheets y Tenants, que consultan solo sus tablas propias. Se proyectan columnas públicas y se revalida cada candidato mediante el contrato comercial existente. Límite de 100 resultados más indicador de truncamiento. Sin migraciones ni dependencias nuevas.

Lint backend/frontend aprobado. Dirigidas backend: 18/18, incluidas composición, filtros inválidos antes de proveedor, fallo de fuente sin convertir a vacío y consulta HTTP real sin sesión desde Salcedo a Latacunga con precio explícito 250, más fecha sin resultados. Frontend completo 319/319. Chrome con HTTP controlado (no certifica API real en ese recorrido): enlaces de viaje/tramo correctos, texto hostil como texto y no script, reflujo 1280/360, fallo que retira resultados anteriores y solo GET, aprobados. Captura móvil inspeccionada en QA temporal entrega-search-qa. Backend real PostgreSQL comprobado por separado en la integración.

El smoke de portada asumía que todos los enlaces eran anclas y fallaba desde el login existente. Conserva la comprobación de destinos de anclas y ahora comprueba además mismo origen, HTTP 200 y contenido de aplicación de cada página enlazada. No se salta la comprobación de enlaces. Primera repetición falló por el nombre de variable del harness nuevo; corregido sin cambiar producto, repetición aprobó escritorio, móvil, teclado y reflujo CSS al 200 % (no zoom nativo).

La regresión previa a Search, con Fleet-08/SMTP/formato y PostgreSQL recién creado, aprobó 1940 unitarias y 650 integraciones. No se atribuye esa ejecución a los cambios posteriores de Search. Revisión humana, prueba de empaquetado y publicación de estos incrementos pendientes. No inventa ocupación ni ofrece compra ya confirmada.

## Plan del recorrido de ciclos y búsqueda — 4 de noviembre de 2026

El solicitante autoriza dividir su trabajo en secciones e implementar únicamente
la primera en la rama que él administra. Las operaciones de Git corresponden
exclusivamente al humano; el asistente no ejecutará ni siquiera comandos de
consulta. Última base comprobada en esta conversación: `d7ea282`; no se afirma
haber vuelto a verificar rama, cambios locales o remoto en este incremento.

| Sección | Resultado delimitado | Spec y dependencia |
|---|---|---|
| 1. Búsqueda por embarque | Prueba HTTP/PostgreSQL real de viaje nocturno: fecha local del origen y de la parada, publicación previa, tarifa explícita y frecuencia activa | SEARCH-01, contrato existente; autorizada en esta sesión |
| 2. Ciclos confirmados | Revisar y comprobar preparación/publicación, límite de períodos e historia conservada; corregir solo defectos reproducidos dentro del contrato vigente | ROUTE-SHEETS-04/07/08; implementación autorizada posteriormente por el solicitante |
| 3. Generación mediante renovación | Repetir el patrón con los mismos buses, revalidar y preparar borrador para publicación explícita | Decisión del solicitante registrada en ROUTE-SHEETS-08 §19; se reutiliza el flujo existente |
| 4. Migraciones en Windows | Reproducir reversiones y añadir diagnóstico seguro, con Edwin como participante propuesto, sin atribuirle aceptación | INFRA-05 autorizada por el solicitante; sin ampliar timeouts ni alterar migraciones |

### Sección 1: alcance y aceptación

Se extiende la suite de integración de viajes sin modificar pruebas existentes,
producto, migraciones, dependencias declaradas ni composición. La API de búsqueda
ya existe: el incremento aporta cobertura faltante del cambio de día.

- Dado un borrador nocturno, buscar su embarque intermedio no devuelve viajes.
- Tras publicar una salida de Ambato a las 23:00 del 1 de enero de 2030 con
  embarque de Salcedo a las 00:20 del 2, cada origen aparece exclusivamente en
  su fecha local de America/Guayaquil; la respuesta conserva embarque y llegada.
- La tarifa completa explícita (999 centavos) difiere de la suma de tramos
  (200 + 250); el precio desde la parada es 250, sin cálculo aditivo.
- Las búsquedas conservan las cantidades de viajes, ciclos e inventarios.
- Una frecuencia inactiva no aparece en la búsqueda.

SOLID: se ejercitan las APIs públicas existentes y su composición real, sin nuevas
abstracciones ni acceso de Search a SQL de módulos ajenos. Sin cambios de pantalla:
la usabilidad visual y el recorrido de navegador quedan fuera de esta sección.
La prueba publica mediante sesión/CSRF reales y busca sin sesión; PostgreSQL
aislado según testing-database.md, sin lectura de `.env`. Revisión humana pendiente.

### Sección 1: evidencia de ejecución

Windows, Node 24.22.2 y PostgreSQL 16.13 efímero, proyecto Compose
`search-seccion1`, usando `--env-file NUL` y credenciales exclusivas de pruebas.
No se instalaron dependencias en esta sección. Resultados reales:

- Suite dirigida `tests/integration/route-sheets/trip-queries.test.js`: **7/7**,
  incluido el caso nocturno nuevo; arranque real de `server.js` y HTTP aprobados.
- `npm run lint` y `npm run format:check`: aprobados.
- `npm test`: **2017/2017 unitarias** (116 suites); **654/684 integraciones**
  (55 suites aprobadas y 7 fallidas). Resultado global fallido, no se declara verde.
- Los 30 fallos de integración proceden de `migrate.js down` en
  `user-cooperative-integrity`, `route-sheet-programming`, `commercial-trips`,
  `cooperative-admin`, `bus.migration`, `bus-group.repository` y `bus-vip-seats`.
  El proceso informa «No se pudo ejecutar la migración. Verifica conexión y
  esquema.»; no se ha diagnosticado aquí la causa ni se atribuye a timeout.
  También se observaron fallos de reversión antes de este incremento en la
  conversación, pero no se ejecutó una comparación nueva contra otra rama.

No se modificaron migraciones, producción, pruebas anteriores ni límites de
tiempo para resolver esos fallos; requieren diagnóstico de la sección 4. Frontend
y navegador no ejecutados en este incremento, que solo añade cobertura backend.
Archivos completos de la prueba y las adiciones documentales revisados mediante
lectura; no se ejecutó diff de Git por instrucción humana. Entorno temporal
retirado al terminar. Sección 1 implementada localmente, pendiente de revisión
humana; no integrada/cerrada. Asistencia de Codex en pruebas y documentación.

### Sección 2: ciclos confirmados

El solicitante autoriza implementar esta sección y pide sugerencia de commit,
sin autorizar operaciones de Git. Se añaden recorridos a la suite de renovación
de ROUTE-SHEETS-08, con contratos existentes de ROUTE-SHEETS-04/07:

- Un borrador renovado no amplía el horizonte comercial ni aparece en búsqueda;
  su publicación explícita incorpora el siguiente período y sus viajes.
- Dos publicaciones simultáneas de ese borrador recuperan el mismo resultado,
  sin duplicar viajes, inventarios ni ciclos. Dos períodos no terminados impiden
  preparar el tercero.
- Con reloj inyectado en el caso de uso real y PostgreSQL, un milisegundo antes
  del fin exclusivo del primero todavía no hay cupo; en el instante exacto se
  permite preparar el tercer borrador contiguo con numeración histórica intacta.
- Preparar y consultar no publican el tercer período. La publicación revalida el
  límite con su reloj, sin confiar en el recibo previo de preparación.
- Las filas comerciales previas de viajes, inventarios, ciclos y serie se
  conservan iguales en ambos recorridos.

Sin nuevas reglas, endpoints, migraciones o pantallas. No se modifica el reloj
del sistema ni se habilita generación/publicación automática. Esta cobertura
comprueba historia comercial; no crea ventas/reservas, por lo que no acredita
por sí sola conservación de compras reales. Revisión humana pendiente.

Resultado: dos recorridos nuevos, suite dirigida de renovación 14/14 aprobada;
lint y formato backend aprobados, 2017/2017 unitarias y repetición completa
686/686 integraciones aprobadas. La primera fase global de integración se
interrumpió sin resumen; no se le atribuyen totales. Evidencia y límites en
[ROUTE-SHEETS-08 §18](ROUTE-SHEETS-08.md#18-verificación-de-ciclos-confirmados--4-de-noviembre-de-2026).
Sin cambios de producto ni operaciones de Git. Sección implementada localmente,
pendiente de revisión humana. No se declara resuelto el origen de los fallos de
reversión anteriores ni completada la generación automática moderna.

### Sección 3: contrato de generación mediante renovación

Ante la pregunta entre repetir el patrón o rotar/reasignar servicios, el
solicitante confirmó: «Repetir el patrón y reutilizar la renovación existente».
Se completa la sección documental adoptando el contrato existente de
[ROUTE-SHEETS-08 §19](ROUTE-SHEETS-08.md#19-sección-3-del-recorrido-repetir-el-patrón-mediante-renovación).
No se crea otra spec ni otro generador para la misma acción.

La copia automática ocurre a petición del administrador, conserva los buses y
desplaza el patrón L días con IDs nuevos y validaciones actuales. Produce DRAFT;
solo la publicación humana explícita amplía ventas. Se mantienen idempotencia,
aislamiento, continuidad, cupo y tarifas editables del destino. No se habilita
scheduler, optimización ni rotación de buses, y no se usa `generate-cycles` legado.

El código backend y la acción web existentes satisfacen este alcance; esta
sección cambia únicamente documentación. Se contrastan sus contratos y enlaces,
sin nuevas pruebas funcionales ni resultados atribuidos a este incremento. La
evidencia de sección 2 conserva su alcance histórico. Revisión humana pendiente;
sin comandos de Git ni declaración de cierre completo de RN-31.

### Sección 4: diagnóstico de migraciones

El solicitante autoriza esta sección y pide commit sugerido y texto de PR de la
rama. [INFRA-05](INFRA-05.md) delimita la herramienta añadida: status de solo
lectura, up mediante migrador existente y down hasta objetivo explícito, solo en
base de prueba. Reporta etapa, nombre/lote, duración y código seguro; no revela
SQL, URL, datos o mensajes internos. No limpia datos ni salta guards.

Tres suites históricamente afectadas aprobaron 36/36 en base limpia. Se añadió
cobertura unitaria del guard y redacción, y CLI/PostgreSQL real de up/down/up y
rechazo protector con auditoría conservada. La reproducción controlada no prueba
la causa de los 30 fallos históricos. No se atribuye corrección de un timeout,
no se cambian migraciones ni se debilitan pruebas. Formato global aprobado.
Resultado completo: lint y formato aprobados; npm test con 2029/2029 unitarias y
688/688 integraciones aprobadas. Limitaciones y evidencia en INFRA-05; los fallos
históricos no se reprodujeron ni se declaran corregidos. Entorno efímero retirado,
sin comandos de Git. Revisión humana e integración pendientes. Texto de la PR
del recorrido en [Markdown](../evidence/SEARCH-01/descripcion-pr.md).
