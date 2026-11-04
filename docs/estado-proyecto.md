# Estado compartido del proyecto

## D-05 — renovación, sección 0 documental, 3 de noviembre de 2026

David autorizó preparar [ROUTE-SHEETS-08](specs/ROUTE-SHEETS-08.md) y aportó la respuesta humana de Leslie. Rama existente `feature/ROUTE-SHEETS-08-renovacion-ciclos`, base `072f845`, inicialmente limpia; fetch comprobó `origin/develop` en `4bb6861`. Se reutiliza la rama sin merge/rebase; el avance remoto se distingue de la base de esta documentación.

| Spec / responsable | Estado y evidencia | Próximo paso |
|---|---|---|
| [ROUTE-SHEETS-08](specs/ROUTE-SHEETS-08.md) / David | Sección 0 en 80c2211 y sección 1 en 4ff9723. David autorizó sección 2: endpoint de preparación, transacción íntegra, clave durable, procedencia y publicación vinculada. Implementación local: 1785/1785 unitarias y 12/12 integraciones propias finales; regresión global 549/550, único timeout previo de fotos de Fleet. Lint/formato propio aprobados; global conserva 39 archivos previos. Evidencia en §16. | Revisión humana y contraste con develop pendientes. Sin commit nuevo, push ni integración. La renovación no cierra gestión de paradas ni sustitución de D-05. |

Leslie acepta la firma de consulta por tramo condicionada a concretar DTO/errores/revalidación; no acredita su consumidor conectado. Detalle de ocupaciones es propuesta sin API pública/commit disponible; protocolo concurrente, versión de Fleet y procedimiento humano de reubicación/comunicación pendientes. Se referencian en ambas specs consumidoras, sin modificar Bookings/Fleet ni habilitar sustitución. Paradas operativas y sustitución se prepararán en specs separadas. Asistencia de Codex en planificación documental; validación de enlaces/diff se registra en la spec.

## PAGOS-02 — resolución local de conflictos de PR #55, 3 de noviembre de 2026

PR #55 publicada en `7448e1a`, con aprobación de Pablo registrada sobre esa
cabeza. Resolución excepcional solicitada por Pablo incorpora `origin/develop`
`feb7f75` en la misma rama y conserva tanto `createPaymentReviewModule` de #55
como `createPaymentReceiptModule` y `createBookingPaymentProofNotifier` de
develop. También conserva íntegra la fotografía PAGOS-01 inferior. Lint, formato
del archivo conciliado, comprobación de las cuatro exportaciones, 84 pruebas
dirigidas y las 1742 unitarias aprobaron con Node 24.21.0. La integración no se
repitió porque Docker Desktop estaba apagado; no se leyó `.env` ni se usó otra
base. La aprobación anterior no se atribuye automáticamente a la nueva cabeza.
Publicación de la resolución autorizada por Pablo; no integrada/cerrada.
[Spec](specs/PAGOS-02.md#18-consumidor-http-de-lectura-con-contexto--3-de-noviembre-de-2026)
y [evidencia](evidence/PAGOS-02/2026-11-03-lector-contexto.md).

## PAGOS-01 — puente interno de recepción preparado, 3 de noviembre de 2026

Base develop `b4fe717` con PR #60 integrada; rama
`feature/PAGOS-01-puente-recepcion`. Consulta pública interna del comprobante/outbox
persistidos y adaptador estricto del receptor de Bookings, sin proveedor simulado
en esta capacidad nueva. Aceptación, rechazo confirmado y resultado incierto
clasificados sin compensación por errores genéricos. No activa rutas/servidor:
conectar UPLOAD_PROOF y Auth reales sigue como siguiente incremento.
37 pruebas nuevas dirigidas; regresión completa 1686 unitarias + 525 integraciones
aprobadas, 127 suites. Lint y formato propio aprobados; 17 pendientes globales
ajenos. Arranque salud 200 y Pagos sin sesión 401. Sin UI, dependencias,
migraciones o pruebas previas modificadas. Sin commit/PR/revisión humana nueva;
no integrada/cerrada. Validación de formatos local y PR #55/#56 siguen separadas.
[Spec](specs/PAGOS-01.md#16-puente-interno-de-recepción-real--3-de-noviembre-de-2026),
[evidencia](evidence/PAGOS-01/2026-11-03-puente-recepcion.md) y
[descripción de PR](evidence/PAGOS-01/descripcion-pr-recepcion.md).

## PAGOS-WEB-01 — bandeja web preparada para revisión, 2 de noviembre de 2026

Shirley precisó «Por ahora termina la pantalla y prepara la PR». Rama
feature/PAGOS-WEB-01-bandeja-pr sobre develop comprobado 5abc36d; conserva
Frecuencias y separa los borradores previos. Pantalla CLERK con listado real,
paginación, archivo privado, estados accesibles y diseño transViaje. Cabecera
no-store en Payments para listados/bytes privados; sin reglas nuevas de Reservas.

168 pruebas frontend y navegador con imagen/proxy/Auth/PostgreSQL reales
aprobados. Backend: lint aprobado, 1298 unitarias y 372 integraciones aprobadas;
formato global fallido en 17 archivos previos. Arranque real: salud 200 y Pagos
sin sesión 401. Reservas sigue simulado: no acredita venta completa. Sin commits,
push, PR publicada ni revisión humana nueva; no integrada/cerrada.
[Spec](specs/PAGOS-WEB-01.md), [evidencia y límites](evidence/PAGOS-WEB-01/2026-11-02-verificacion.md)
y [descripción de PR](evidence/PAGOS-WEB-01/descripcion-pr.md). Revisor Pablo pendiente.

## D-06 — creación de frecuencias, sección 2 local, 2 de noviembre de 2026

Sobre ab27485, David autorizó la conexión real y solo la preparación necesaria de la prueba anterior del widget. [FREQUENCIES-WEB-01 §12](specs/FREQUENCIES-WEB-01.md#12-sección-2--sesión-api-y-empaquetado) documenta sesión/rol/tenant verificados, cliente HTTP/CSRF compartido, POST sin tenant, protección contra doble envío, errores comprensibles y bloqueo ante alta no confirmada. Éxito presenta ID/resumen real en lectura; crear otra frecuencia limpia y revalida. Página/módulos/CSS incluidos y comprobados desde imagen real. Sin modificaciones a backend, login, transporte, navegación global, dependencias ni migraciones.

Frontend: lint y **144 unitarias aprobadas (16 nuevas)**; **7 comprobaciones previas del widget y 10 recorridos nuevos con API/imagen/PostgreSQL reales aprobados**, incluido aislamiento entre cooperativas, pérdida de recepción tras persistir y caída de API. Preparación del smoke anterior adaptada con autorización, aserciones intactas. Capturas móvil/escritorio inspeccionadas. Backend general: lint aprobado, **1297 unitarias y 371 integraciones aprobadas, una falla por timeout conocido de fotos de Fleet**. Formato propio aprobado; 41 avisos globales previos. API real bajo imagen Node 24; suite completa Node 24 pendiente (host 22.19.0). Entornos efímeros retirados; sin .env leído. Implementación local, sin commit/PR/merge ni aprobación humana nueva. Listado/estado y hoja manual siguen como tareas separadas; accesibilidad ampliada pendiente según spec. Evidencia inferior conserva estados históricos.

## D-06 — creación de frecuencias, sección 1 local, 2 de noviembre de 2026

Sobre 954e7fc, David autorizó sección 1 y confirmó Q1: capturar valores por tramo del registro aclarando que el precio comercial se configura en la hoja. [FREQUENCIES-WEB-01 §11](specs/FREQUENCIES-WEB-01.md#11-sección-1--formulario-local) documenta formulario, paradas ordenables, resolución ANT, hora/medianoche, revisión local accesible y descarte de valores de enlaces afectados. Página sin API/sesión/POST; no registra ni simula altas. Estado/validación separados de vista y renderizado seguro; DESIGN.md aplicado con CSS local sin cambiar estilos comunes.

Frontend: 128 unitarias aprobadas (13 nuevas), lint y 7 comprobaciones de navegador con teclado/móvil/contraste aprobadas, cero solicitudes API; capturas inspeccionadas. Backend: lint aprobado; 1297 unitarias y 371 integraciones aprobadas, una falla por timeout conocido de fotos de Fleet. Formato de cambios aprobado; formato global conserva 41 pendientes previos. Node 24 pendiente; PostgreSQL temporal retirado. No se modifican backend, dependencias, migraciones, pruebas previas ni empaquetado. Sección 2 pendiente de autorización: sesión, envío real y Docker. Q1 queda resuelto; los pendientes inferiores conservan contexto histórico. Sin commit/PR/revisión humana nuevos inferidos.

## D-06 — creación de frecuencias, sección 0 documental, 2 de noviembre de 2026

David confirmó D-06 como pantallas operativas y autorizó solo sección 0 de su primera tarea. Rama feature/FREQUENCIES-WEB-01-creacion-frecuencias, inicialmente limpia sobre 1daa3c4 (D-04/PR #49 integrada en la historia local; sin fetch). [FREQUENCIES-WEB-01](specs/FREQUENCIES-WEB-01.md) define alta por COOPERATIVE_ADMIN, ANT obligatoria, inmutabilidad posterior, paradas ordenadas, cliente HTTP/sesión compartidos y adopción de DESIGN.md. Tres secciones/un commit por sección: documentación, formulario local y conexión API real.

Q1 pendiente antes de implementar: el POST actual exige precios consecutivos históricos, mientras la tarifa comercial corresponde a la hoja. Propuesta: capturarlos explícitamente con ayuda que distinga ambos usos; alternativa, adaptación backend en otra tarea. No fabricar valores ni sumar tramos para ventas. El alta solo guarda nombres de paradas; horarios fechados se programan en la hoja, sin afirmar que existan horarios normativos de parada en la frecuencia. Listado/estado y hoja manual son tareas separadas; desactivación al cierre del ciclo y lecturas HTTP de buses/tarifario requieren revisión antes de esas pantallas. Renovación/excepciones quedan fuera hasta sus contratos implementados.

Cambios solo Markdown; sin pruebas funcionales, producto, dependencias, commits ni publicación. Spec en preparación documental, no aprobada por Leslie/Pablo ni integrada. Próximo paso: confirmar Q1 y autorizar sección 1. La evidencia inferior conserva estados históricos.

## D-04 — sección 2 local, 2 de noviembre de 2026

Sobre 2e3cdca, David confirmó Q5 y autorizó API interna `tripQueries.findBookableById` y `findBookableForSegment`, sin GET público ni cambios en Bookings. [ROUTE-SHEETS-07 §14](specs/ROUTE-SHEETS-07.md#14-sección-2--consulta-comercial-por-embarque) documenta identidad estable, copias congeladas, cierre por parada y horizonte de ciclos publicados. Lectura coherente de tablas propias y fuentes mediante APIs públicas, liberando la conexión antes de consultar otros módulos. La consulta no reserva asientos; Leslie debe conectar el control por par y las ocupaciones en Bookings.

1297 unitarias globales aprobadas; integración global: 370 aprobadas y una falla por timeout en bus-photo-storage, reproducida aisladamente (17 aprobadas/una falla), sin modificar esa prueba ni su límite. Comprobación final de las 36 nuevas registrada en §14. Lint y formato de cambios aprobados; formato global conserva 41 pendientes anteriores. Node local 22.19.0; Node 24 pendiente. Sin dependencias, migraciones ni pruebas anteriores modificadas; revisión humana/integración remota pendientes, sin commit/PR/merge ejecutados. Los estados inferiores conservan evidencia histórica.

## D-04 — sección 1 local, 2 de noviembre de 2026

En feature/ROUTE-SHEETS-07-viajes-comercializables sobre 4e5c8df, David solicitó sección 1 y confirmó Q1–Q4: publicaciones nuevas, captura atómica, copia propia de asientos desde Fleet de solo lectura y vínculo explícito de serie/ciclos sin renovación automática. [ROUTE-SHEETS-07 §13](specs/ROUTE-SHEETS-07.md#13-sección-1--captura-comercial-al-publicar) documenta cuatro tablas nuevas, identidades estables, copias inmutables por hoja/bus, referencias al recorrido/tarifa y respuesta de publicación con manifiesto comercial. Hoja histórica publicada no se reconstruye; ciclo siguiente requiere seriesId explícito y período consecutivo de igual duración.

53 pruebas nuevas aprobadas (34 unitarias/19 integración con servidor/proveedores reales). **Final: npm test aprobado, 1267 unitarias + 366 integraciones = 1633**, con arranque real comprobado; lint, formato de cambios y diff aprobados. Preparación de pruebas antiguas/listas de limpieza y preparación de reversión de programación adaptadas con autorización expresa, sin cambios a comprobaciones/timeouts. 74 enlaces locales válidos; PostgreSQL temporal busesuta-trips-s1 retirado. Formato global conserva 41 pendientes previos y Node 24 sigue sin verificar. Sin dependencias nuevas, migraciones históricas modificadas, commit/PR nuevo o aprobación humana atribuida. Q5 y sección 2 pendientes: no tripQueries productivo ni integración de compra con Bookings. Evidencia inferior conserva los pendientes históricos ya respondidos.

## D-04 — sección 0 documental, 2 de noviembre de 2026

En `feature/ROUTE-SHEETS-07-viajes-comercializables`, inicialmente limpia sobre 1dcbd6d, David solicitó sección 0. Esa historia integra D-03/PR #48; no se confunde con una implementación de Viajes. [ROUTE-SHEETS-07](specs/ROUTE-SHEETS-07.md) queda Borrador: identidad estable, captura comercial al publicar, recorrido/embarque, contratos propuestos y tres secciones/un commit por sección. Sin código, migraciones, commit/PR nuevo ni revisión humana inferida.

Pendientes Q1–Q5: creación atómica de viajes, propiedad/consistencia del inventario congelado con Edwin, alcance de hojas históricas, vínculo verificable de ciclos y consulta por embarque con Leslie. Fleet entrega asientos actuales pero no versión por hoja; Bookings aún no comprueba hora del embarque elegido. No basta el ID de frecuencia ni la ventana antigua de hoy+28 días. Puede avanzar el acuerdo documental; no declarar lista la comercialización completa. Revisar §10 antes de sección 1; no atribuir respuestas nuevas a otros integrantes. Solo Markdown, sin nuevas pruebas funcionales.

## D-03 — sección 2 local, 2 de noviembre de 2026

David solicitó sección 2 en `feature/programacion-multifrecuencia-persistida`, limpia sobre ec9556e (sección 1 guardada por el humano). PUT/GET de programación con administrador/CSRF/tenant verificados, lectura consistente y revisiones independientes; publicar exige programación revalidada y congela tarifa/estado en la misma transacción. Se conservan snapshots/reintentos históricos; rutas antiguas y sus carreras no eluden validación integral. Composición conectada al servidor real, sin nuevos algoritmos, migraciones o dependencias en este incremento. [Spec §14](specs/ROUTE-SHEETS-06.md#14-sección-2--api-y-publicación-integradas-localmente) contiene contrato/evidencia.

Preparación de pruebas antiguas adaptada con autorización expresa, sin modificar sus comprobaciones. 58 pruebas nuevas (26 unitarias/32 HTTP); 72 dirigidas aprobadas incluyendo congelación tarifaria. **Final: npm test aprobado, 1129 unitarias + 329 integraciones (1458)** y arranque real comprobado. Se conserva evidencia de un fixture nuevo duplicado corregido y de un timeout intermedio de Fleet; seis pruebas de esa suite aprobaron aisladas sin cambios y la global final también aprobó, sin modificar timeouts. Lint/formato de cambios y diff aprobados; 59 enlaces locales válidos. Formato global conserva 41 pendientes previos; repetir bajo Node 24 controlado sigue pendiente (local 22.19.0). PostgreSQL temporal busesuta-programming-s2 retirado. D-04/05 y frontend siguen pendientes; no commit, PR, aprobación humana ni integración de esta sección inferidos. La evidencia inferior conserva sus estados históricos.

## D-03 — sección 1 local, 2 de noviembre de 2026

En `feature/programacion-multifrecuencia-persistida` sobre 2890d2b, David solicitó sección 1 y confirmó P1–P4 de [ROUTE-SHEETS-06](specs/ROUTE-SHEETS-06.md). Guardado transaccional de programación completa con revisión, servicios/fechas/puntos, identidades estables, disponibilidad, traslados y bloqueos; consultas públicas reales de Fleet/Frecuencias, compromisos entre hojas, rollback y auditoría. Migración nueva conserva datos legados sin tiempos inventados; [ADR 0006](adr/0006-serializacion-de-programacion.md) documenta lock de escritura global del módulo y su coste de paralelismo. No SQL de otro módulo ni nuevos endpoints.

El solicitante autorizó solo listas TRUNCATE de cuatro suites antiguas para las siete tablas nuevas; escenarios y comprobaciones intactos. Dependencias restauradas del lock, sin cambios de versiones. Verificación final: **1103 unitarias + 297 integraciones aprobadas (1400)**, incluidas 57 nuevas; lint y formato de cambios aprobados. Formato global mantiene 41 archivos previos pendientes, cuatro migraciones históricas preservadas. Diff revisado/comprobado; 60 enlaces locales válidos. PostgreSQL efímero busesuta-programming-s1 retirado. Node local 22.19.0; repetir bajo Node 24 controlado sigue pendiente: revisión automática rechazó el montaje/copia del código en la imagen local no verificada, acción no ejecutada. Sección 2 (HTTP/publicación) y D-04/05 no implementadas; no commit/PR nuevo ni aprobación humana inferida. La evidencia de sección 0 inferior conserva su contexto histórico y sus decisiones ya fueron respondidas.

## D-03 — sección 0 documental, 2 de noviembre de 2026

David solicitó preparar sección 0 en `feature/programacion-multifrecuencia-persistida`, base `8fdf7e4`, inicialmente limpia y coincidente con la referencia local origin/develop (sin fetch). La historia contiene corrección de publicación `1e9d956`; no se atribuye nueva verificación del login ni inspección remota de PR. [ROUTE-SHEETS-06](specs/ROUTE-SHEETS-06.md) queda Borrador: contrato de persistencia/HTTP, identidad estable, revisión, compatibilidad tarifaria, conflictos entre hojas y migraciones nuevas, sin implementarlos.

Tres secciones/un commit por sección: 0 documentación, 1 persistencia y caso de uso, 2 HTTP y publicación. Antes de sección 1 confirmar propuestas P1–P4 de la spec (hoja/ciclo, ocupación de borradores, adopción legada y tiempos de paradas); no confundir con reglas ya acordadas de D-01. Consulta de Fleet bajo concurrencia requiere comprobar contrato público, sin SQL ajeno ni aprobación inventada. Viaje comercializable sigue en D-04, renovación/sustitución en D-05. Solo Markdown; sin pruebas funcionales nuevas, cambios de producto, commit o PR de D-03.
## AUTH-WEB-01 — pantalla sobre controlador integrado, 2 de noviembre de 2026

Fetch comprobado: origin/develop 8fdf7e4, merge de PR #42 confirmado a las
10:55:13 Ecuador. Su aprobación de Shirley cubre controlador/lint, no la pantalla.
Rama feature/AUTH-WEB-01-pantalla-login desde esa base; vista/página recuperadas
de b1f3761 y QA de 99c8a91, sin perder Fleet. [Spec sección 19](specs/AUTH-WEB-01.md).
Login real, imagen y 115 pruebas frontend aprobados; backend lint, 1068 unitarias
y 275 integraciones aprobados; 17 avisos de formato preexistentes pendientes.
Guardado atómico solicitado; sin publicación ni revisión humana nueva de pantalla. Documentos de
feature/ACUERDOS-01-dependencias-pagos resguardados en stash identificado
respaldo-documentacion-dependencias-pagos-antes-pantalla-login; no se mezclan
con este incremento ni se atribuyen como integrados.


## ROUTE-SHEETS-05 — adaptación de pruebas de publicación, 2 de noviembre de 2026

Rama `feature/ROUTE-SHEETS-05-corrige-pruebas-publicacion`, base comprobada `7ef2f25`, inicialmente limpia; contiene tarifario integrado en `1fb0ade`/PR #39. Tras el reporte humano de Pablo, David autorizó adaptar las dos pruebas antiguas al puerto transaccional vigente. Se conserva publicación con tarifa y error de hoja inexistente (404), añadiendo comprobaciones de contexto, frecuencia y congelación. Sin cambios de producción, migraciones, dependencias o D-03. Sin commit/PR nuevos ni revisión humana inferidos; no se inspeccionó remotamente PR #42.

31 pruebas dirigidas aprobadas; lint y formato del archivo cambiado aprobados. Repetición unitaria con acceso HTTP local permitido: 1022 pruebas aprobadas, 61 suites aprobadas/una fallida al cargar por busboy ausente. Formato global pendiente en 41 archivos previos, cuatro de ellos migraciones preservadas. Node local 22.19.0 frente a engine 24. Integración aislada: 179 aprobadas/una fallida; 15 suites aprobadas/8 fallidas (siete por busboy ausente y una por timeout de fotos). Recursos temporales de busesuta-publish-fix retirados, diff revisado/comprobado. Evidencia y alcance en [spec](specs/ROUTE-SHEETS-05.md); los pendientes históricos inferiores no sustituyen esta comprobación. Corrección local lista para revisión, sin afirmar suite global verde ni integración nueva.

## ROUTE-SHEETS-05 sección 2 — congelación y consulta locales

Rama feature/tarifario-hojas-ruta-spec sobre 4875147 (sección 1 guardada por el humano), inicialmente limpia. El solicitante pidió sección 2 y confirmó el contrato findPublishedByRouteSheetId/findPrice; sin atribuir respuesta individual nueva de Leslie. Publicación valida tarifa/asignaciones/recorrido, bloquea hoja y frecuencias por APIs públicas y congela copia/versionado/estado en una transacción. Reintentos idempotentes; lectura aislada e inmutable, null para ausencia y propagación de errores, sin precio cero ni suma de tramos como fallback. Migración nueva protege copia congelada; [ADR 0005](adr/0005-lecturas-publicas-en-transaccion.md) registra la sesión pública transaccional aplicada localmente, pendiente de revisión.

43 pruebas nuevas aprobadas (29 unitarias y 14 integraciones); junto a sección 1, 110 dirigidas aprobadas. Lint/formato de archivos cambiados aprobados; formato global fallido en 41 archivos previos. Unitarias globales: 1020 aprobadas/2 fallidas; 60 suites aprobadas/2 fallidas. Fleet no carga por busboy ausente y las dos fallidas de publicación usan el puerto/expectativa antiguos (una publica sin tarifa). Conservadas sin cambios; no se habilita publicación sin tarifa para ocultarlas. Revisión y adaptación autorizada de esas pruebas pendientes antes de integrar, sin tratarlas como defectos académicos.

Integración separada: 179 aprobadas/1 fallida, 15 suites aprobadas/8 fallidas (siete por busboy y una por timeout de fotos). Arranque de server.js intentado y bloqueado por busboy; Node 22.19.0 local frente a engine 24 requerido. PostgreSQL aislado busesuta-tariff-s2 con --env-file NUL; recursos temporales retirados al terminar. No .env de desarrollo, dependencias nuevas, commits ni publicación. Diff revisado/comprobado; evidencia completa y contrato en [spec §13](specs/ROUTE-SHEETS-05.md). Secciones implementadas no implican módulo integrado/cerrado ni conexión productiva con Bookings.

## ROUTE-SHEETS-05 sección 1 — tarifario de borrador local

En feature/tarifario-hojas-ruta-spec sobre 7519854, el solicitante confirmó mayor beneficio sin acumular, congelación al publicar, renovación a borrador, porcentajes 0–100 %/dos decimales y máximo histórico USD 99 999 999,99. No se atribuyen respuestas individuales de Leslie/Edwin. Sección 1 implementada localmente: PUT autenticado/CSRF, matriz completa por frecuencia asignada, política explícita en puntos básicos, recorrido desde API pública de Frecuencias y reemplazo transaccional con revisión esperada. Migración nueva agrega borrador/revisión/auditoría a route_sheets, sin modificar migraciones o pruebas previas. Sección 2 (congelación/publicación/consulta) sigue sin implementar; firma de lectura con Leslie pendiente.

Pruebas nuevas: 53 unitarias y 14 integraciones aprobadas, con autenticación y PostgreSQL reales; incluyen dos ediciones concurrentes, rollback y tenant/rol/CSRF. Lint aprobado; formato de cambios comprobado, global fallido en 42 archivos previos ajenos (router modificado formateado). npm test: 993 pruebas aprobadas, 60 suites aprobadas/1 fallida por busboy ausente, sin alcanzar integración. Integración separada: 165 aprobadas/1 fallida, 14 suites aprobadas/8 fallidas (siete no cargan por busboy y una supera timeout de fotos). Node local 22.19.0 frente a engine 24 requerido; arranque real intentado y bloqueado al cargar Fleet por busboy ausente. No se declara suite global/arranque aprobados ni se modificaron dependencias/timeouts.

PostgreSQL efímero busesuta-tariff-s1 con --env-file NUL, credenciales ficticias versionadas; recursos retirados al terminar. Evidencia y contrato en [spec](specs/ROUTE-SHEETS-05.md). Diff revisado/comprobado; sin commit, PR ni revisión humana de sección 1. Antes de integrar: restaurar entorno de dependencias/Node 24 y verificar suite/arranque; no confundir las limitaciones del entorno con defectos académicos autorizados.

## D-02 — preparación del tarifario por hoja, 1 de noviembre de 2026

| Spec / responsable | Estado comprobado | Próximo paso |
|---|---|---|
| [ROUTE-SHEETS-05](specs/ROUTE-SHEETS-05.md) / David | Borrador funcional; sección 0 documental completada en feature/tarifario-hojas-ruta-spec sobre 8886553, inicialmente limpia. Sin código, commit, revisión humana ni PR de D-02. | Resolver decisiones de §10 con Leslie/responsable comercial; luego autorizar sección 1. Sección 2 depende de configuración persistida y contrato de lectura. No requiere esperar implementación VIP para preparar dominio. |

Base local 8886553/PR #38 acredita integración de ROUTE-SHEETS-04 (D-01); no convierte su validación pura en endpoints/persistencia multifrecuencia. No se refrescó remoto en esta sesión. Secciones de D-02: 0 definición; 1 configurar tarifario de borrador; 2 congelar al publicar/exponer consulta. Un commit lógico por sección, ejecutado solo a petición humana.

Brechas comprobadas: precios consecutivos en Frecuencias, sin matriz pública ni copia comercial en publicación de hoja; BOOK-05 mantiene cálculo histórico que necesita contrato nuevo. No se autoriza cambiar código de Leslie/Edwin. Diff revisado, `git diff --check` aprobado y 52 referencias locales comprobadas sin destinos inexistentes (excluidos externos/anclas); cuatro documentos existentes y una spec nueva. No lint/Jest por cambio solo Markdown. No se presenta la entrega como terminada.

## ROUTE-SHEETS-04 sección 2 — implementación local

David solicitó sección 2 tras guardar sección 1 en 7be2587. Rama feature/programacion-multifrecuencia-spec inicialmente limpia. Patrón con cobertura por frecuencia/instante, agenda por bus, período explícito en días, límites de preparación/bloqueos y repetibilidad; ventana con reloj explícito, base incluida en dos ciclos, borradores excluidos de venta, límite exclusivo y renovación informativa sin renumerar historia. Cinco archivos nuevos de dominio y dos de pruebas; snapshots inmutables. Sin endpoints, persistencia, generación productiva, dependencias ni pruebas anteriores modificadas. Secciones 0–2 preparadas/implementadas; no equivalen a integración operativa de D-03/04/05.

93 pruebas nuevas aprobadas; 172 dirigidas aprobadas incluyendo sección 1. Lint global/formato nuevo aprobados; formato global fallido en 43 archivos previos. npm test falló por busboy ausente, sin alcanzar integración; repetición unitaria final con acceso local: 940 pruebas aprobadas, 58 suites aprobadas/1 fallida por carga de busboy. Integración separada en PostgreSQL aislado: 151 pruebas aprobadas/1 fallida; 13 suites aprobadas/8 fallidas (siete por busboy y una por timeout de fotos). Sin cambios a expectativas/timeouts. Docker temporal busesuta-rs04-s2 retirado; detalles en [spec](specs/ROUTE-SHEETS-04.md). Diff revisado y comprobado; commit de sección 2, revisión humana, restauración del entorno y suite global satisfactoria pendientes antes de integrar. No se ejecutaron commits.

## ROUTE-SHEETS-04 sección 1 — implementación local

David solicitó implementar sección 1 en feature/programacion-multifrecuencia-spec sobre f1a347f (sección 0 guardada por el humano). Validador puro de agenda implementado: fechas con offset, preparación, continuidad/traslados, disponibilidad inicial, REST/MAINTENANCE, aislamiento de snapshots y resultado inmutable; 79 pruebas nuevas aprobadas. No endpoints, BD, asignaciones persistidas, dependencias ni pruebas existentes modificadas. Sección 2 todavía sin autorización ni implementación.

Lint global aprobado y formato de los cuatro JS nuevos aprobado. Formato global fallido en 43 archivos ajenos. npm test inicial: 844 pruebas unitarias aprobadas/3 fallidas, 55 suites aprobadas/2 fallidas (busboy ausente y EACCES HTTP); no alcanzó integración. Repetición unitaria con acceso local permitido: 847 pruebas aprobadas, 56 suites aprobadas/1 fallida por carga de busboy. Integración independiente en PostgreSQL efímero aislado: 151 aprobadas/1 fallida, 13 suites aprobadas/8 fallidas (siete no cargan por busboy y una supera timeout de fotos). No se cambiaron expectativas ni timeouts. Suite global sigue fallida; detalles/reproducción en [spec](specs/ROUTE-SHEETS-04.md). Contenedor/red del proyecto de pruebas busesuta-rs04-s1 retirados al terminar. Diff comprobado sin errores; sin commit/PR/revisión humana ni integración de sección 1.

## Programación multifrecuencia D-01 — 1 de noviembre de 2026

| Spec / responsable | Estado y evidencia | Próxima acción |
|---|---|---|
| [ROUTE-SHEETS-04](specs/ROUTE-SHEETS-04.md) / David | Contrato definido por delegación del solicitante tras aceptación de propuestas con Edwin/Leslie reportada en chat. Rama feature/programacion-multifrecuencia-spec, base b60201e/PR #35, inicialmente limpia. Sin implementación, commit ni PR nueva. Se examinaron referencias locales, sin refresco remoto; no se certifican cambios externos posteriores. | El usuario autoriza secciones una a una: 1 validación pura de agenda; 2 patrón/ciclos/ventana. D-03 persistencia/HTTP, D-04 viajes y D-05 excepciones requieren sus propias specs antes de implementar. |

Decisiones: dos ciclos totales incluida base; confirmación antes de venta; ciclo en días y patrón manual; preparación explícita y traslados fechados; disponibilidad y cobertura completas; ventana referida al inicio del patrón, cierre al embarque. Ya no se tratan esos puntos como preguntas abiertas de D-01. Pendientes independientes: tarifas, inventario accesible, reubicación y contratos productivos. Revisor de código por confirmar; el acuerdo no equivale a revisión de PR.

Reparto aclarado por el usuario: tres secciones, un commit por sección. Sección 0 documental completada localmente, sin commit; secciones 1 (agenda) y 2 (patrón/ventana) pendientes de autorización de implementación. Cada futuro commit funcional incluye código, pruebas y su evidencia; no tres commits por sección.

Validación documental: `git diff --check` aprobado; 48 referencias locales en los documentos afectados comprobadas sin destinos inexistentes, excluyendo enlaces externos/anclas. Cuatro documentos existentes modificados y una spec nueva; ningún archivo funcional. No se ejecutan lint/Jest: sin código ni configuración ejecutable; ninguna prueba funcional nueva acreditada.

## Actualización documental de acuerdos — 1 de noviembre de 2026

Base local comprobada `0b4041e` (PR #33), coincidente con la referencia local origin/develop; no se refrescó el remoto en esta revisión. Rama limpia inicial `feature/acuerdos-funcionales-primera-entrega`. Las filas inferiores conservan evidencia histórica, no la fotografía de estos nuevos acuerdos.

| Spec | Responsable / estado | Evidencia y pendiente |
|---|---|---|
| [ACUERDOS-01](specs/ACUERDOS-01.md) | Preparación solicitada en chat; revisión documental local | Respuestas y apuntes consolidados en [acuerdos](acuerdos-primera-entrega.md); reglas/specs afectadas enlazadas. Sin código, commits, publicación, integración ni aprobación individual de otros integrantes. Revisor humano por designar. |
| [ACADEMICA-01](specs/ACADEMICA-01.md) | Borrador; responsable de introducción por confirmar | Dos candidatos visuales propuestos, ninguno introducido ni autorizado individualmente. Versión/revisor y selección pendientes. |

FREQ-02 ya tiene integración histórica en `56dc55a`/PR #25 y el arranque actual crea frecuencias. ROUTE-SHEETS-02 está presente en `0b4041e`/PR #33 y compone hojas; esto corrige el pendiente de integración de las filas históricas, sin inventar cierre humano ni nueva prueba. Sigue ausente la inyección productiva de bookingQueries. Las nuevas reglas requieren implementación posterior; no se marca el sistema listo para el 4 de noviembre.

Prioridades propuestas: contratos de programación/viaje y tarifario → inventario VIP/accesible → reserva persistida/correcciones/efectivo → boleto/correo/acceso → pantallas y prueba completa Docker. Mantener tareas pequeñas y confirmar contratos/revisores. Wallet y rol Chofer/Controlador fuera de primera entrega. No reclasificar funcionalidad faltante como defecto inducido.

Verificación de esta tarea: diff documental revisado, `git diff --check` aprobado y 130 referencias locales comprobadas sin destinos inexistentes (excluidos enlaces externos y anclas). Solo Markdown: 26 archivos existentes modificados y tres nuevos. No se ejecutan lint/Jest/arranque, sin código ni configuración ejecutable; las suites históricas no validan los nuevos contratos. Git avisa de normalización CRLF→LF en tres documentos; no son fallos funcionales. El intento inicial de edición con Python no se ejecutó por el alias de Windows inaccesible; la actualización se realizó con herramientas de texto y PowerShell.

## Alcance y frescura de esta fotografía

- **Fecha de comprobación:** 2 de noviembre de 2026, America/Guayaquil; conciliación y nueva verificación local de Pagos para preparar revisión. Las otras áreas conservan sus fechas y evidencia histórica.
- **Base remota consultada:** `develop` en `3d053a4`, comprobada mediante el plugin de GitHub tras integrar PR #45. PR #46 permanece abierta, con conformidad documental APPROVED de Shirley sobre `ad74d25`. No se incorporó esa base ni cambió la rama local de PAGOS-02. Las consultas de `8fdf7e4` y limitaciones del 1 de noviembre conservan alcance histórico.
- **Cambio local actual:** PAGOS-02 y ajuste coordinado de contrato PAGOS-01 en `feature/PAGOS-02-aprobar-comprobante`, HEAD `4e6bbf7`, con base común `518c46b`. Trabajo previo conservado; se añadió adaptador consumidor de lectura no conectado y 74 pruebas, además de las 14 HTTP anteriores. Nueva ejecución completa: 45 suites/668 unitarias y 14 suites/134 integraciones aprobadas (802 total). Lint y formato propio (32 JS) aprobados; `format:check` global falla en 48 archivos ajenos. Base temporal retirada. Arranque real anterior conserva su fecha; no cambió composición productiva. Rutas anteriores con Reservas simulado, sin venta real ni combinación con develop actual. [Evidencia actual](evidence/PAGOS-02/2026-11-02-adaptador-lector.md).
- **PAGOS-01:** el merge commit `f26415d` integra PAGOS-01 en la referencia local `origin/develop`; las pruebas registradas son de la rama de origen, no una repetición posterior al merge.
- **Alcance de esta actualización:** diseño seleccionado en PR #46 y aprobación documental de Shirley comprobados; §12 del [contrato local](pagos-reservas-find-for-payment.md) reemplaza sus preguntas genéricas anteriores. La solicitud de continuar autorizó el adaptador acotado de PAGOS-02 §17: tres archivos nuevos, sin modificar casos de uso/controladores/composición. [Descripción detallada de PR](evidence/PAGOS-02/descripcion-pr.md) con alcance, resultados, revisores y pendientes. El proveedor y la conexión real siguen pendientes; sin publicación ni integración de PAGOS-02.
- **Fuentes:** árbol/reglas remotas de la base consultada, specs locales de Pagos, mensajes humanos de Leslie/Pablo y los dos adjuntos completos de Leslie, posteriores a su HEAD reportado `c7ceed9` y todavía sin publicación. No se certifica código privado ni implementación por recibir borradores. Distribución de referencia en [equipo-y-acuerdos.md](equipo-y-acuerdos.md).

Este archivo orienta; la spec es la fuente del alcance y business-rules.md la de reglas funcionales. Si el código y la spec difieren, mostrar ambas evidencias y pedir resolver el conflicto, sin inventar acuerdos.

## Estados y actualización

Flujo de tareas con spec: **Borrador → Aprobada → En desarrollo → En revisión → Integrada → Cerrada**. Si está bloqueada, conservar su estado y añadir motivo, personas que pueden resolverlo y próxima acción independiente. **Propuesta sin spec** se usa solo para candidatos del desglose, no equivale a Aprobada.

Integrada exige evidencia del commit en develop; Cerrada requiere además revisión humana y verificación del comportamiento acordado. La presencia de archivos no prueba que funcione el recorrido completo. Las specs antiguas pueden conservar estados históricos; esta fotografía indica lo que se pudo contrastar.

Antes de orientar a alguien:
1. Consultar rama, cambios locales, spec y este registro. Actualizar origin/develop mediante fetch si está permitido y hay conexión, sin cambiar a develop ni sobrescribir trabajo.
2. Comparar la referencia nueva con la base indicada y revisar los cambios pertinentes. Si no se puede actualizar, declarar la fecha/commit conocido y la incertidumbre.
3. Comprobar si la tarea ya está en una rama o PR accesible antes de recomendar rehacerla. No afirmar que una rama local está publicada, aprobada o integrada.
4. Actualizar solo filas propias de la tarea, evidencia y dependencias afectadas, conservando el trabajo de otros. Cada autor propone la actualización en su PR; quien integra coordina el estado posterior. Resolver conflictos comprobando evidencia, no eligiendo el estado más avanzado.

## Trabajo observado

| Spec / área | Responsable de referencia | Estado observado en la base | Evidencia y próxima comprobación |
|---|---|---|---|
| [INFRA-01](specs/INFRA-01.md) | Pablo | Código integrado | Backend, migraciones, Compose, lint y Jest; verificar entorno de cada integrante |
| [AUTH-01](specs/AUTH-01.md), [AUTH-02](specs/AUTH-02.md), [AUTH-03](specs/AUTH-03.md), [AUTH-04](specs/AUTH-04.md) | Pablo | Código integrado | Login, autorización, logout y registro; algunas specs todavía indican revisión/integración pendientes; confirmar cierre humano |
| [TENANTS-01](specs/TENANTS-01.md), [AUTH-FK-01](specs/AUTH-FK-01.md), [AUTH-05](specs/AUTH-05.md) | Pablo | Código integrado | Cooperativas, integridad y administrador principal; no implica pantallas ni provisión del primer SYSTEM_ADMIN |
| AUTH-BOOTSTRAP-01 | Pablo | [PR #52](https://github.com/Pato77232/ProyectoBusesUTA/pull/52) publicada contra `develop`; Shirley solicitada para revisión | Rama `feature/AUTH-BOOTSTRAP-01-base-actual` sobre base `1dcbd6d` conserva la corrección `9b65e9f`; lint aprobado, 1249 unitarias + 352 integraciones PostgreSQL aprobadas. Formato global falla en 17 archivos preexistentes. Pruebas tras combinar con `develop`, revisión humana e integración pendientes. |
| [AUTH-06](specs/AUTH-06.md) | Pablo | [PR #53](https://github.com/Pato77232/ProyectoBusesUTA/pull/53) publicada contra `develop`; Shirley solicitada para revisión | Rama `feature/AUTH-06-crear-oficinista` sobre base `1dcbd6d`: lint y formato propio aprobados; 1235 unitarias + 355 integraciones PostgreSQL aprobadas; arranque real health 200 y alta anónima 401. Formato global falla en 17 archivos preexistentes. Pruebas tras combinar con `develop`, revisión humana e integración pendientes. |
| [FLEET-01](specs/FLEET-01.md) | Edwin | Código integrado, PR #10 | Crear/listar grupos; catálogo y alta disponibles mediante FLEET-03/FLEET-02 |
| [FLEET-02](specs/FLEET-02.md) | Edwin | Alta integrada por PR #27 en 4f34748; corrección de fotos integrada por PR #28 en b1e6720 | PR #27 aprobada por David. Develop comprobado el 1 de noviembre en b1e6720; suite real con FLEET-04: 786 unitarias y 239 integraciones aprobadas (1025), sin montaje correctivo |
| [FLEET-03](specs/FLEET-03.md) | Edwin | Código integrado, PR #26 | Tres plantillas con asientos normales; VIP y silla de ruedas de RN-12 requieren otra tarea. Las claves del catálogo no sustituyen UUID de asientos por bus |
| [FREQ-01](specs/FREQ-01.md) | David | Código funcional integrado; conexión al arranque desarrollada en FREQ-02, pendiente de integrar en `develop` | La responsabilidad se actualizó por confirmación de David. El commit local `7026418` conecta el módulo al servidor; lint y pruebas pasan en esta rama. No atribuir este cambio local a `develop`. |
| [FREQ-02](specs/FREQ-02.md) | David | En desarrollo en `feature/FREQ-02-arranque-frecuencias` | `npm test`: 42 suites/566 unitarias y 13 suites/116 de integración; lint y arranque real aprobados. `GET /api/v1/frequencies` sin credenciales responde 401 desde el servidor. Chequeo global de formato señala 48 archivos no modificados; archivos cambiados pasan Prettier individualmente. |
| [ROUTE-SHEETS-01](specs/ROUTE-SHEETS-01.md) | David, según distribución; confirmar autor/responsable | Código integrado, PR #13; integración operativa pendiente | app.js admite routeSheets, pero server.js no lo instancia; la composición necesita contratos con fleet/frequencies/bookings |
| FLEET-05 | Edwin, según distribución; por confirmar | T1 local en otro worktree, commit 00085d5; sin PR ni rama remota observada | feature/FLEET-05-pantalla-registro-buses: formulario sin conexión a API, según su spec en esa rama. T2/transporte y proxy requieren acuerdo con Pablo; login y política de sesión/CSRF pendientes. Evidencias históricas allí: 41 pruebas y 8 comprobaciones de pantalla; no reejecutadas en esta consulta |
| [FLEET-04](specs/FLEET-04.md) | Edwin | En revisión, PR #29 | T1 3ddfc26 y T2 782c4b0 publicados sobre b1e6720. Lint y 786 unitarias + 239 integraciones aprobadas (1025), formato propio correcto; 20 archivos previos pendientes. Contrato confirmado por David según Edwin; revisión humana de código e integración pendientes |
| [ROUTE-SHEETS-02](specs/ROUTE-SHEETS-02.md) | David | Integrada en PR #33/0b4041e; proveedor productivo de reservas pendiente | Se conserva el historial de pruebas de su spec. Al verificar AUTH-WEB-01 sobre esta base: lint y 801 unitarias + 239 integraciones aprobados, arranque real con PostgreSQL y login aprobados. Esto no certifica todos los recorridos de hojas de ruta; BOOK-03 sigue pendiente. |
| [INFRA-02](specs/INFRA-02.md), [INFRA-03](specs/INFRA-03.md) | Shirley; revisor indicado Pablo | Cambios presentes; cierre documental pendiente | cross-env y .gitattributes presentes, lock actualizado en historial; no implica aprobación humana ni validación Windows actual |
| [INFRA-04](specs/INFRA-04.md) | Pablo; revisora propuesta Shirley | Integrada: su código documental está contenido en c89b1b9 | La presencia en develop está comprobada; no se inventa evidencia de revisión humana/cierre |
| [FRONT-01](specs/FRONT-01.md) | Pablo | T3c/T3d integradas; T4 pendiente | PR #32 aprobada por David22x e integrada en d0a5f8d. Login funcional se verifica aparte mediante AUTH-WEB-01; no implica cierre de toda la base frontend. |
| [AUTH-WEB-01](specs/AUTH-WEB-01.md) | Pablo; Shirley aprobó controlador/lint, pantalla por revisar | Controlador integrado en PR #42/8fdf7e4; pantalla verificada localmente, guardado atómico solicitado; sin PR | 2 de noviembre: rama feature/AUTH-WEB-01-pantalla-login, base 8fdf7e4. Lint/formato propio y 115 pruebas frontend aprobados; test:login con API/Docker real aprobado. Backend: lint y npm test completo aprobados (1068 unitarias + 275 integraciones); formato previo falla en 17 archivos. Spec sección 19; revisión humana de pantalla pendiente. |
| [FLEET-05](specs/FLEET-05.md) | Edwin | T1/T2 integradas; T3 en [PR #63](https://github.com/Pato77232/ProyectoBusesUTA/pull/63) para revisión, implementación ffc0798 y corrección 53df664 | Repetición de corrección: 227 pruebas frontend, lint y formato de los dos JS aprobados. Respuesta de alta no verificable se trata como incierta sin reintentos. Evidencia anterior: 9 comprobaciones Chrome y 3 de API real; no repetidas en esta actualización. CSS y smoke de portada con pendientes previos documentados. Falta revisión humana; listado/detalle fuera del alcance. |
| [FLEET-06](specs/FLEET-06.md) | Edwin | T1 en [PR #41](https://github.com/Pato77232/ProyectoBusesUTA/pull/41) en borrador; implementación 7d6353a sobre 1fb0ade | listByBus entrega todos los asientos con identidad propia, layoutSeatKey y offered; confirmación de Leslie pendiente. 21 pruebas específicas aprobadas. Global: 1066 unitarias aprobadas/2 fallidas; integración 274 aprobadas/1 timeout en user-cooperative-integrity. Versión por hoja, VIP y accesibilidad pendientes; detalles en la spec. |
| [FLEET-07](specs/FLEET-07.md) | Edwin | T1 preparada para revisión en [PR #44](https://github.com/Pato77232/ProyectoBusesUTA/pull/44); sin integración | 3 de noviembre: VIP no ofrecido confirmado por Edwin; migración VIP renumerada con autorización y SQL intacto; reversión independiente de la última migración. Integración Linux/PostgreSQL aislado 280/280, prueba con migración posterior 5/5 y upgrade desde develop aprobados. Unitarias globales 1074 aprobadas/2 fallidas de hojas de ruta; base conservada sin merge por decisión de Edwin. Leslie y revisión humana pendientes; T2 aparte. |
| [FLEET-09](specs/FLEET-09.md) | Edwin | Plan documental en [PR #58](https://github.com/Pato77232/ProyectoBusesUTA/pull/58), sin implementación; decisiones acordadas con David el 3 de noviembre | Inmutabilidad en BD propuesta con pruebas adaptadas conservando cobertura; versiones como modelo futuro y sustitución en D-05 de Route Sheets. David aceptó revisar según mensaje reportado por Edwin; falta autorización de T1 y contrato con Leslie para D-05. Diff documental comprobado, sin pruebas de producto. |
| search, bookings, payments y tickets | Según propuesta inferior | Sin implementación en la base examinada | Confirmar ramas de los responsables antes de crear tareas |
| [PAGOS-01](specs/PAGOS-01.md) | Shirley | Código integrado en `origin/develop` en `f26415d`; revisión/cierre humano no se infieren | El merge commit `f26415d` incorpora PAGOS-01 (`518c46b` como segundo padre). La evidencia de pruebas registrada corresponde a la rama de origen, no a una repetición posterior al merge. `bookings` sigue simulado conforme al alcance T4. |
| [PAGOS-02](specs/PAGOS-02.md) | Shirley; Pablo (@PabloToapanta) revisor aceptado; Leslie complementaria propuesta | En desarrollo; adaptador no conectado y pruebas verificadas, descripción detallada de PR sin publicación | Rama `feature/PAGOS-02-aprobar-comprobante`, base común `518c46b`; rutas con Reservas simulado. Nuevo adaptador de contrato con 74 casos; suite global 668 unitarias + 134 integraciones aprobadas (802). Lint/formato propio aprobados; formato global fallido en 48 ajenos. Conexión real, versiones/importe observado y combinación con develop pendientes. [Evidencia](evidence/PAGOS-02/2026-11-02-adaptador-lector.md). |
| [Lectura `findForPayment`](pagos-reservas-find-for-payment.md), anexo de PAGOS-01/02 y BOOK-07-L05 | Pablo seleccionó por delegación reportada; Leslie proveedor, Shirley consumidor | Diseño seleccionado en PR #46 con conformidad documental; adaptador consumidor acotado probado | proofWindowStartedAt explícito, contexto/códigos seleccionados y recepción persistida requerida. No repetir aceptación genérica del diseño. Adaptador nuevo no conectado; Leslie debe publicar persistencia/proveedor y sus pruebas. El lector anterior de las rutas aún no cambió; F11 y la matriz completa de proveedor siguen pendientes. |
| PAGOS-03, planificación S-03 | Shirley; Pablo aceptó revisar el incremento | Borrador existente en la referencia local `origin/feature/PAGOS-01-subir-comprobante`, commit `72887bd`; no está en la rama actual PAGOS-02 ni consta aprobación técnica | Rechazo justificado y liberación coordinada; falta concretar `releaseBooking` y recuperación entre módulos. No se crea una segunda spec con el mismo ID. |
| PAGOS-CORR-01, planificación S-03 | Shirley; Pablo aceptó revisar el incremento | Borrador local conciliado el 2 de noviembre, separado de la publicación PAGOS-02; no aprobado para implementar | PR #35 ya confirma 3/15 minutos; eventos técnicos, rondas, versionado/correo y efecto del vencimiento siguen pendientes. Leslie no aprobó cerrar edición/mantener revisión al vencer. Depende de S-02, L-05, PAGOS-01/02 y P-03. |
| PAGOS-CAJA-01, relacionada con S-04 | Shirley; Pablo aceptó revisar el incremento | Borrador local conciliado el 2 de noviembre, separado de la publicación PAGOS-02; no aprobado para implementar | PR #35 confirma efectivo mediante reserva y sin archivo de depósito. Plazo de caja, titularidad, abandono/cancelación, resultados e idempotencia siguen pendientes. Depende de P-02, L-03 y L-05. |
| CI | Pablo | Sin workflow versionado en la base | Proponer una spec propia; no afirmar protecciones remotas sin consultarlas |

## Actualización parcial de reservas — 27 de octubre de 2026

Solo tareas de Leslie, contrastadas con origin/develop e96a277; las filas anteriores conservan su fotografía histórica.

| Spec / área | Estado comprobado | Evidencia y dependencia |
| --- | --- | --- |
| BOOK-02/04/05/06, incrementos del PR #15 | Integrados en e96a277 | GitHub confirma PR #15 fusionado. El dominio no incorpora por sí solo almacenamiento ni pantallas. |
| BOOK-07 T1 | PR #17 abierto, aprobado por Shirley | Contrato documental; no equivale a funciones ni pruebas de carrera implementadas. |
| BOOK-03 T1 | A y B implementadas localmente; revisión humana pendiente | BOOK-03-T1.md; 81 pruebas nuevas, 631 unitarias aprobadas. Integración sin base aislada disponible en esta sesión. Viajes y plantillas reales siguen sin proveedor público comprobado; no se sustituye por inventario ficticio. |
## Actualización parcial de reservas — 28 de octubre de 2026

Solo tareas de Leslie. Misma rama local feature/BOOK-03-resumen-creacion-dominio; se conserva la fotografía histórica anterior.

| Spec / área | Estado local | Evidencia y siguiente paso |
| --- | --- | --- |
| BOOK-03 T1 | Partes A/B implementadas localmente | ae5f29d y 7eb41ba; resumen y valor inicial de dominio, ahora comprobados también en la suite completa con base aislada. |
| BOOK-03 T2 | Persistencia y concurrencia verificadas localmente; revisión humana pendiente | BOOK-03-T2.md, ADR 0005 y 16 pruebas nuevas de PostgreSQL. Total de esta rama: 754 aprobadas. Faltan T3/T4 y proveedores reales antes de habilitar compra. |
| Contrato de viaje y plantilla | Seleccionado por Leslie según delegación transmitida de David/Edwin | TripCatalog.findBookableById y snapshot de BOOK-03-T1/T2; esto no implementa los adaptadores ni certifica su funcionamiento. |

Actualización de AUTH-BOOTSTRAP-01 (2 de noviembre): la [PR #52](https://github.com/Pato77232/ProyectoBusesUTA/pull/52) se concilió con `develop` `f5b9bde` sin marcadores de conflicto. La combinación temporal aprobó lint, 1315 unitarias y 385 integraciones PostgreSQL (1700); el formato global conserva 17 archivos ajenos. [Evidencia detallada](specs/AUTH-BOOTSTRAP-01.md#conciliación-de-la-pr-52-con-develop--2-de-noviembre-de-2026). Revisión humana e integración pendientes; la fila conserva el conteo histórico de la rama anterior.

## Próximos pasos por integrante

### Actualización de Fleet — 29 de octubre de 2026

- Base remota comprobada: `f26415d`. Las PR #10 y #22 de grupos/reversibilidad están integradas; la presencia en el historial no sustituye una verificación nueva de toda la base.
- Edwin solicitó continuar con buses y asientos. Se prepara [FLEET-02](specs/FLEET-02.md), **Borrador**, para registrar un bus, en `feature/FLEET-02-registro-buses`, sin implementación todavía.
- Edwin confirmó cooperativa única por bus, placa y número de unidad obligatorios y fotografías en carpeta local persistente mediante volumen Docker, con referencias en PostgreSQL: de 1 a 10 imágenes JPEG/PNG por bus, hasta 5 MB por archivo. Chasis significa VIN y se conserva obligatorio, confirmado por Edwin conforme a RN-10. Edwin confirmó placa y VIN únicos globalmente y número de unidad único por cooperativa (unidad 1 permitida en Loja y Santa con placa/VIN distintos), además de selección de plantilla existente al alta, antes de habilitar viajes; 36/42 asientos son ejemplos sin confirmar. Pendientes: formatos y normalización, clasificación/número de grupos, carga/entrega de fotografías y contrato real de plantillas. La propuesta de grupos por pisos/paradas difiere de RN-11; conservar la decisión pendiente. Consulta de buses y definición/consulta de asientos son incrementos posteriores; el contrato de identificadores necesita acuerdo con Leslie y David. Revisor propuesto David, sin confirmación registrada.
- Edwin aportó referencias de plantillas: un piso 2+2 (42 asientos en la imagen), dos pisos 2+2 (44 arriba y 16 abajo) y confirmó una variante de dos pisos 2+1: 34 arriba y 12 abajo, 46 en total, con individuales del lado de la escalera y espacios de servicios conservados. Confirmó numeración desde arriba, par 1–2 e individual 3, hacia atrás, continuando abajo (1–34 arriba, 35–46 abajo). Cada cooperativa configura la capacidad de cada bus; Edwin aceptó activar/desactivar posiciones de una base al alta siempre que se mantenga sencillo, sin editor libre ni renumeración. Cambios posteriores con viajes/reservas y contrato de identificadores/ocupación por viaje siguen pendientes de acuerdo. No hay implementación de plantillas.
- Edwin aceptó el modelo conceptual de asientos con identidad estable por bus y ocupación por viaje/tramo: reutilización entre viajes y tramos no superpuestos. Nombres de tablas y contrato compartido pendientes de contraste con Leslie y David; no se autorizan cambios a sus módulos.
- Revisión del 30 de octubre: Edwin mantiene la propuesta de coordinación preparada para Leslie y David, sin respuestas de ellos registradas. Fetch comprobó `origin/develop` en `1d9381d` (caché CSRF integrada en PR #24); la rama Fleet sigue sobre `f26415d` con documentación local sin commit. El remoto también modificó este registro: conservar ambas actualizaciones al integrar. El catálogo/consulta de plantillas requiere su spec propia como dependencia del alta; no hay código nuevo de Fleet ni pruebas de producto ejecutadas en esta revisión.
- Edwin confirmó el 30 de octubre solo asientos normales para las tres bases de FLEET-03; VIP y espacios para silla de ruedas quedan fuera del primer catálogo. RN-12 no se modifica ni se declara cubierta por completo; su alcance restante requiere una tarea posterior.
- [FLEET-03](specs/FLEET-03.md): Edwin aprobó el alcance y autorizó iniciar el 30 de octubre; **En desarrollo**, rama feature/FLEET-03-catalogo-plantillas sobre f26415d. Primer incremento: tres distribuciones, validación e inmutabilidad y 28 pruebas específicas aprobadas. La suite unitaria completa aprobó 592 pruebas con acceso HTTP local permitido; lint y formato de los archivos nuevos correctos, formato global fallido en 24 archivos existentes sin modificar. Caso de uso/endpoint, revisión técnica y acuerdos compartidos aún pendientes; no hay pantalla, cambios de reservas, migraciones ni integración. Edwin solicitó guardar y publicar los cambios el 30 de octubre; borrador de alta separado del incremento de catálogo en commits atómicos. Suite final con PostgreSQL 16.13 aislado: 592 unitarias y 116 de integración aprobadas (708 en total), con 28 pruebas específicas nuevas. Los intentos anteriores fallaron por restricciones HTTP y arranque de BD pendiente; la ejecución final aprobó sin cambios a pruebas anteriores. Evidencia en la spec.
- FLEET-03, continuación del 30 de octubre: PR #26 abierta en borrador por petición de Edwin. Catálogo de lectura completado con puerto, caso de uso, API pública y GET /api/v1/seat-layouts para COOPERATIVE_ADMIN, montado en app.js. Validación con arranque real y PostgreSQL aislado: 602 unitarias y 126 integraciones aprobadas, 728 totales. Lint/formato del incremento correctos; formato global pendiente en 24 archivos previos. Estado En revisión, no integrada; borrador para revisión humana, sin pantalla, alta de buses ni inventario de reservas. El contrato compartido con Leslie/David sigue pendiente.
- FLEET-02, 31 de octubre: Edwin aprobó el contrato y autorizó comenzar; En desarrollo, T1 local en feature/FLEET-02-contrato-alta sobre d1d3542. Normalización/validación de metadatos, grupo y copia/configuración de asientos en dominio, con 93 pruebas nuevas dirigidas aprobadas. Lint/formato nuevo correctos; formato global pendiente en 24 archivos previos. Origin/develop comprobado 56dc55a, PR #26 todavía abierta; sin merge/rebase, cambios a esa PR, commits ni push. T2–T4 (persistencia, fotos, HTTP) pendientes; Suite: 695 unitarias aprobadas; integración inicial 123 aprobadas/3 timeouts, repetición en base limpia 125 aprobadas/1 timeout de migraciones generales (database.test.js), sin cambiar pruebas ni su límite de 20 s. La integración sigue fallida; evidencia en FLEET-02.
- Verificación adicional T1 antes del commit autorizado por Edwin: npm test en Docker Node 24.21.0 + PostgreSQL 16.13, fuente de solo lectura y dependencias del lock en volumen temporal, aprobó 695 unitarias y 126 integraciones (821 total), sin cambiar timeout ni pruebas. La prueba general de migraciones tardó 5,105 s; fallos anteriores de Windows conservados en spec. Formato global sigue pendiente en 24 archivos previos.
- No se ha enviado ningún mensaje a otros integrantes ni se presupone su aprobación. Las filas históricas siguientes conservan su fecha y alcance; el registro de buses ya tiene borrador de spec, pero no está aprobado para implementar.
- FLEET-02, continuación documental del 30 de octubre: Edwin confirmó un grupo operativo por bus dentro de su cooperativa y marca de carrocería/color como texto libre obligatorio, sin catálogos nuevos. Contrato preparado en feature/FLEET-02-contrato-alta sobre d1d3542 para no modificar la PR #26, ya lista para revisión humana. Faltan formatos/normalización de identificadores y detalles de carga/consistencia de fotos; sigue Borrador, sin implementación del alta ni publicación de esta continuación.
- Edwin precisó placa de tres letras y cuatro dígitos para el alta de buses: guardar/comparar TBM2213 y presentar TBM-2213. Contrato de normalización/duplicados registrado en FLEET-02, sin consulta ANT. Formato de VIN y número de unidad aún pendientes; no hay implementación nueva.
- Edwin confirmó también VIN en mayúsculas y sin espacios exteriores y unidad entera positiva (01 y 1 son la misma identidad dentro de una cooperativa). Quedan definidos los identificadores y ámbitos de unicidad; falta cerrar el contrato técnico de carga de fotografías/alta y su consistencia. No se añaden validaciones externas ni patrón/longitud de VIN no acordados; FLEET-02 sigue en preparación, sin implementación de alta.
- FLEET-02: por petición de Edwin se completó el contrato técnico en feature/FLEET-02-contrato-alta (data/photos multipart, campos, snapshot/UUID de asientos, 5 000 000 bytes por imagen, almacenamiento persistente separado, errores, compensación y COMMIT incierto, plan T1–T4). Edwin confirmó exigir al menos un asiento ofrecido al alta; contrato técnico listo para revisión/aprobación de implementación. No implica código implementado ni tarea cerrada; sin dependencias instaladas, commits/push ni pruebas de producto de esta continuación.

Orden recomendado para discutir con el equipo. Cada fila es **Propuesta sin spec**, salvo la referencia a una tarea existente. Confirmar asignación y disponibilidad; las prioridades no son fechas comprometidas. Las pantallas se separan cuando su contrato está listo.

| Integrante | Orden y tarea pequeña propuesta | Dependencia / primer paso |
|---|---|---|
| Pablo | 1. Registrar la revisión/cierre de INFRA-04 cuando exista evidencia humana | Su contenido ya está en develop; no repetir implementación ni autoaprobar |
| Pablo | 2. Atender revisión de AUTH-BOOTSTRAP-01 | [PR #52](https://github.com/Pato77232/ProyectoBusesUTA/pull/52) lista y Shirley solicitada; comprobar la combinación y repetir pruebas antes de integrar. |
| Pablo | 3. Completar AUTH-WEB-01 y su revisión por incrementos | T3d integrada. Conexión de login local; cerrar evidencia y preparar entregas pequeñas. Navegación pendiente; coordinación Fleet en f5a6fbe, sin aceptación inferida de multipart/proxy. |
| Pablo | 4. Atender revisión de AUTH-06 | [PR #53](https://github.com/Pato77232/ProyectoBusesUTA/pull/53) lista y Shirley solicitada; comprobar la combinación y repetir pruebas antes de integrar. No inferir aprobación por la ejecución local. |
| Pablo | 5. Preparar CI y luego pantallas de acceso/cooperativas, una por tarea | Specs separadas; CI depende del entorno de integración, pantallas de la base frontend |
| Edwin | 1. Registrar un bus con los datos RN-10 | Spec y acuerdo de fotografías/almacenamiento; grupo de buses existente |
| Edwin | 2. Consultar buses de la cooperativa | Contrato público requerido por hojas de ruta; coordinar con David |
| Edwin | 3. Definir y consultar plantilla de asientos, en tareas separadas | Acordar identificadores, pisos y tipos con Leslie; RN-12 |
| Edwin | 4. Pantalla de registro y luego consulta de buses | Contratos anteriores y base frontend |
| David | 1. Preparar revisión humana de [FREQ-02](specs/FREQ-02.md) | Registrar la sección 2; confirmar revisora y conservar pendiente la integración en `develop` hasta que haya evidencia |
| David | 2. Resolver preguntas abiertas de [ROUTE-SHEETS-02](specs/ROUTE-SHEETS-02.md) y confirmar alcance | Fleet ya expone `busQueries` en `develop`; acordar con Pablo las consultas públicas de frecuencias y con Leslie la consulta de pasajeros; mantener búsqueda fuera de alcance hasta confirmarla |
| David | 3. Exponer consulta de viajes por fecha | Acordar Trip, ventana de compra y fuente del bus con búsqueda/reservas |
| David | 4. Pantalla de creación de frecuencia y luego listado/estado | Backend conectado y base frontend; specs separadas |
| David | 5. Pantalla de hoja de ruta manual | Contratos y pruebas de integración operativa resueltos |
| Leslie | 1. Acordar disponibilidad e identidad del asiento por viaje | Edwin y David; definir contrato antes de implementar consulta |
| Leslie | 2. Registrar pasajeros y calcular descuentos, en tareas separadas | Resolver porcentajes, edades y validación de cédula de RN-43 con el equipo |
| Leslie | 3. Reservar asientos con control de concurrencia | Viaje/asiento definidos; prueba de dos reservas simultáneas RN-40 |
| Leslie | 4. Expirar reservas y luego pantalla de selección | Acordar plazo/comprobante con Shirley; RN-50/51; base frontend para pantalla |
| Shirley | 1. Preparar revisión del PAGOS-02 local y coordinar disponibilidad del proveedor con Leslie | Diseño seleccionado en PR #46; aprobación documental comprobada y adaptador consumidor probado. No repetir aceptación genérica. Pablo revisa el código; Leslie aporta proveedor/persistencia y compatibilidad. Separar documentación de correcciones/caja al preparar publicación |
| Shirley | 2. Preparar conexión de carga/listado con lectura real tras aprobar contrato y proveedor | PAGOS-01 ya tiene carga y PAGOS-02 bandeja local; no rehacerlas. Falta API productiva de Reservas y migración explícita de los dos consumidores al contexto autorizado |
| Shirley | 3. Completar PAGOS-02 y resolver dependencias S-02/L-05/P-03; revisar con Leslie PAGOS-CORR-01, PAGOS-03 y PAGOS-CAJA-01 | La aprobación y bandeja existentes no se rehacen. Corrección, rechazo y caja tienen alcances separados; confirmar reglas y contratos antes de implementar |
| Shirley | 4. Emitir boleto QR y luego consultar historial, en tareas separadas | Aprobación, asiento vendido e identidad cliente/invitado acordados |
| Shirley | 5. Pantallas de comprobante y bandeja, una por tarea | Endpoints y base frontend |

Búsqueda consolidada todavía requiere asignación confirmada. La propuesta original permite apoyo de Pablo en búsqueda y Edwin en historial solo cuando terminen sus primeras tareas; no es una reasignación aprobada. No desatenderla por no tener responsable: acordarlo junto con el contrato de viajes.

## Acuerdos que desbloquean trabajo

| Tema | Participantes propuestos | Evidencia que falta |
|---|---|---|
| Buses/grupos/frecuencias para hojas de ruta | Edwin, David y Pablo para composición | Contratos públicos concretos y prueba del arranque real |
| Precio y ciclos | David, Leslie y responsable de búsqueda por confirmar | FREQ-01 decide precio por tramo, pero business-rules.md aún lo pregunta; ROUTE-SHEETS-01 agrega ciclos/ventana; reconciliar fuentes sin inventar otra regla |
| Descuentos y cédula | Leslie y equipo | Porcentajes, edades y forma de validación aprobados |
| Lectura, plazo y comprobante | Leslie y Shirley; Pablo para Auth | Revisar contrato concreto de lectura; luego recepción/versiones, importe validado y recuperación. Plazos 3/15 conocidos; eventos, rondas y vencimiento de corrección pendientes |
| Invitado, tarjeta y caja | Leslie, Shirley y Pablo para Auth/correo | Invitado requiere contexto de compra de Auth; tarjeta/métodos concretos pendientes. Efectivo mediante reserva ya confirmado; concretar plazo, abandono, cancelación e idempotencia de caja |
| Frontend compartido | Pablo y autores de pantallas | Contratos de navegación, origen, mensajes y criterios de usabilidad |

Usar [equipo-y-acuerdos.md](equipo-y-acuerdos.md) para preparar la consulta y registrar la respuesta humana. Los defectos inducidos siguen sin definición concreta en el protocolo; no introducirlos por iniciativa propia.

## Evidencia de calidad

Resultados actuales de INFRA-04 se registran en su [spec](specs/INFRA-04.md). No confundir evidencia histórica de otras specs con una ejecución actual. Los fallos preexistentes se reportan sin corregirlos de paso ni declarar la entrega lista.

## Actualización parcial de reservas — 29 de octubre de 2026

Solo tareas de Leslie. origin/develop consultado en e556e59, aún no incorporado a esta rama.

| Spec / área | Estado comprobado | Evidencia y siguiente paso |
| --- | --- | --- |
| BOOK-03 T3 A | Caso de uso de resumen implementado localmente | BOOK-03-T3.md; 32 pruebas nuevas y 663 unitarias aprobadas, lint aprobado. Falta B, integración del incremento y T4. No abrir PR por este commit. |
| BOOK-07 T1 | PR #17 cerrado sin merge | Contrato conservado en 292617b. Leslie decide recuperarlo con la implementación de pagos/expiración en una entrega funcional, sin rehacerlo ni abrir otro PR solo documental. |

| BOOK-03 T3 B | Creación transaccional implementada y verificada localmente | BOOK-03-T3.md; 30 unitarias nuevas y siete de PostgreSQL. Suite completa: 693 unitarias + 130 integración = 823 aprobadas. No hay endpoints ni proveedores reales compuestos; revisión humana pendiente. |
| Entrega funcional de reservas | En preparación, sin PR nuevo | Leslie solicita un PR por funcionalidad hacia develop, con varios commits, specs y pruebas. Faltan T4, proveedores reales y recuperación segura de creación incierta; no se publica cada paso. |

## Actualización parcial de reservas — recuperación de creación, 29 de octubre de 2026

Solo tareas de Leslie. Misma rama local feature/BOOK-03-resumen-creacion-dominio. origin/develop consultado en f26415d, todavía no incorporado.

| Spec / área | Estado comprobado | Evidencia y siguiente paso |
| --- | --- | --- |
| BOOK-03 T3 R | Recuperación idempotente implementada localmente; revisión humana pendiente | BOOK-03-T3-R.md; 53 pruebas nuevas. npm test completo: 725 unitarias y 151 de integración, 876 aprobadas. Misma clave/dueño/datos recupera ID, total y plazo; otros datos dan conflicto. |
| Entrega funcional BOOK-03 | En preparación, sin PR nuevo | Continúan pendientes T4, proveedores reales y actualización con develop. Se conserva un único PR futuro de funcionalidad hacia develop, con especificaciones, código, pruebas y varios commits. |

## Actualización parcial de reservas — API protegida, 29 de octubre de 2026

Solo tareas de Leslie. Misma rama local feature/BOOK-03-resumen-creacion-dominio, actualizada desde develop f26415d mediante 8df558a; sin integrar la entrega hacia develop.

| Spec / área | Estado comprobado | Evidencia y siguiente paso |
| --- | --- | --- |
| BOOK-03 T4 A | API montada y verificada localmente; revisión humana pendiente | BOOK-03-T4.md y reservas-api.md; 27 unitarias nuevas y 25 HTTP. Suite conjunta: 766 unitarias + 185 integración = 951 aprobadas; arranque real comprobado. |
| Catálogo/acreditación | Aún no compuestos con proveedores reales | Rutas nuevas responden 503 sin datos simulados; reintentos de reservas existentes conservan recuperación con sesión válida. No se afirma compra operativa. |
| Entrega funcional BOOK-03 | En preparación, sin PR nuevo | Falta T4 B (pantalla), proveedores reales y revisión humana. Mantener un solo PR funcional hacia develop con todos sus commits/specs/pruebas. |

## Actualización parcial de reservas — recuperación de pantalla, 29 de octubre de 2026

| Spec / área de Leslie | Estado local | Evidencia |
| --- | --- | --- |
| BOOK-03 T4 B, parte A | Consulta del resultado implementada; revisión humana pendiente | GET propio por clave y dueño; siete unitarias y tres HTTP nuevas. Suite completa: 773 unitarias + 188 integración = 961 aprobadas. Pantalla B aún en implementación, sin afirmar QA visual. |

## Actualización parcial de reservas — pantalla, 29 de octubre de 2026

| Spec / área de Leslie | Estado comprobado | Evidencia y dependencia |
| --- | --- | --- |
| BOOK-03 T4 B, pantalla | Implementada y verificada localmente; revisión humana pendiente | 45 pruebas frontend, lint/formato, Chrome con API/PostgreSQL reales, contenedor y portada aprobados. Selección/pasajeros/resumen/aceptación/recuperación. Guía reservas-pantalla.md. |
| BOOK-03 T4 B, lectura de resultado | Implementada en 7a57e1c | Suite backend completa: 773 unitarias + 188 integración = 961 aprobadas. Consulta solo propio comprador, sin reactivar ni prorrogar. |
| Integración de compra real | Pendiente | Catálogo de viajes/plantillas, acreditación/revisión asistida y entrada desde búsqueda/login. Sin proveedores el servidor da 503; no hay datos simulados de producción. |
| Revisión de entrega | Pendiente | Un solo PR futuro de funcionalidad hacia develop, con specs/código/pruebas y commits por tarea. QA con datos ficticios no equivale a aprobación humana ni compra de producción. |

## Actualización parcial de reservas — acceso de cliente, 29 de octubre de 2026

| Spec / área de Leslie | Estado comprobado | Evidencia y siguiente paso |
| --- | --- | --- |
| BOOK-03 T4 C | Acceso real integrado en pantalla; revisión humana pendiente | 54 pruebas frontend, lint/formato, Chrome con argon2/JWT/cookies/CSRF/PostgreSQL reales y contenedor aprobado. No se modificaron módulos internos de auth. |
| Recuperación de sesión | Implementada localmente | Sesión revocada retira datos privados, conserva clave y nuevo acceso recupera mismo ID/plazo por GET, sin otro POST. |
| Activación de compra real | Pendiente | origin/develop sigue en f26415d al consultar; no hay catálogo/plantilla real disponible en ramas revisadas. Faltan esos proveedores, acreditación/revisión asistida y entrada desde búsqueda. |

## Planificación de reservas L-01 a L-06 — 1 de noviembre de 2026

Comprobación de esta sesión: rama original feature/BOOK-03-resumen-creacion-dominio en c7ceed9, limpia al comenzar. Fetch actualizado: origin/develop b60201e, sin integrar. Se verificaron PR #25/#26/#27/#29/#33/#35 integrados y #31 abierto. Fleet ya tiene registro/consultas de buses y catálogo; hojas y frecuencias ya se componen en develop. Las filas históricas que los presentan pendientes no describen esta base actual. Sigue pendiente el catálogo público de viaje comercializable con política/inventario congelados.

| Planificación de Leslie | Spec / estado | Evidencia y próxima condición |
| --- | --- | --- |
| L-01, cotización | [BOOK-05-L01](specs/BOOK-05-L01.md), Borrador | Leslie confirma mayor beneficio sin acumular en este chat. Acreditación, límites/precisión, congelación y desglose pendientes. 50 % fijo y suma obligatoria no son autoridad nueva. |
| L-02, disponibilidad | [BOOK-02-L02](specs/BOOK-02-L02.md), Borrador | Reutilizar T2a; falta proveedor de viaje real/versionado, no recrear buses. HTTP/pantalla locales no acreditan integración real. |
| L-03, persistencia | [BOOK-03-L03](specs/BOOK-03-L03.md), Borrador | Transacción, ocupaciones e idempotencia existen localmente; falta relación hoja/asignación y política nueva. Invitado pendiente de contrato propio. |
| L-04, expiración | [BOOK-06-L04](specs/BOOK-06-L04.md), Borrador | Coordinar recepción, expiración durable y recuperación. No decidir consecuencia por vencer corrección de 15 minutos. |
| L-05, API pública | [BOOK-07-L05](specs/BOOK-07-L05.md), Borrador | Consultas booleanas de David documentadas en ROUTE-SHEETS-02 según su reporte; implementación real pendiente. Firmas y autorización de pagos requieren cierre con Shirley. |
| L-06, pantallas | [BOOK-08-L06](specs/BOOK-08-L06.md), Borrador | Reutilizar pantalla/acceso locales; DESIGN.md aplicado como requisito del borrador. Datos reales, contactos, acreditación e invitado pendientes. |

[Plan, referencias remotas y puertas de implementación](reservas-plan-primera-entrega.md). No se implementa producto, altera migraciones/pruebas, instala dependencias o ejecuta commit/push/merge/rebase/tag. No se introduce defecto inducido. Los 961 tests backend y 54 frontend son evidencia histórica, no ejecución actual ni prueba de la nueva política. Lint/format:check/npm test/PostgreSQL/arranque no ejecutados en esta sesión exclusivamente documental; Verificación documental: 62 referencias locales en 14 documentos comprobadas sin destinos inexistentes, sin espacios finales; git diff --check aprobado. Rama y HEAD permanecen iguales. Revisión humana, autorización de incrementos e integración pendientes.

## Contrato de tarifas recibido de David — 2 de noviembre de 2026

Fuente: respuesta de David pegada por Leslie. Fetch actualiza origin/develop a 1fb0ade; rama de tarifas publicada en 43a0a30; PR #39 comprobada merged. La rama local de Leslie permanece c7ceed9, con borradores documentales sin commit.

| Área de Leslie | Evidencia actual | Próxima condición |
| --- | --- | --- |
| L-01, proveedor de tarifa | API tariffQueries publicada e integrada: findPublishedByRouteSheetId y findPrice; pares explícitos, bps 0..10000, congelación al publicar y revisión comercial | Desempate confirmado por Leslie: conservar categorías empatadas y aplicar una vez. Completar acreditación con Shirley y conciliación del desglose; después autorizar cálculo puro |
| L-02, proveedor de viaje | David confirma identidad estable y reglas comerciales; tripQueries.findBookableById es propuesta, no implementación | Precisar posición/fecha de embarque y contrato con inventario histórico de Edwin |
| Calidad del tarifario de David | 110 pruebas dirigidas reportadas; fallos globales y arranque bloqueado documentados en ROUTE-SHEETS-05/PR #39 | No presentar integración como prueba global aprobada; reproducción y revisión pendientes |

Detalles en [BOOK-05-L01](specs/BOOK-05-L01.md) y [BOOK-02-L02](specs/BOOK-02-L02.md). No código, migraciones, dependencias, cambios de pruebas ni operaciones de commit/publicación/integración en esta sesión. No se repiten pruebas de producto para este registro documental.

## Inventario de Edwin recibido — 2 de noviembre de 2026

Leslie transmite respuesta de Edwin sobre FLEET-06. Comprobación independiente: origin/develop 7c150c7 contiene 7d6353a y API seatQueries.listByBus({ busId, cooperativeId }); ya existe PR #41, por lo que «sin PR» en el mensaje recibido es histórico. API con UUID de asiento por bus, geometría/categoría NORMAL/offered y errores propagados. Ver actualización de [L-02](specs/BOOK-02-L02.md) y [L-03](specs/BOOK-03-L03.md).

El mínimo permite preparar integración de NORMAL ofrecidos; no acredita versión por hoja, VIP/accesibilidad, viaje comercializable ni compra completa. No se atribuye aceptación del contrato a Leslie por reenviar el mensaje. Confirmación/autorización y coordinación con David pendientes. Sin cambios funcionales ni repetición de pruebas del proveedor.
## Documentos locales de Shirley revisados — 2 de noviembre de 2026

Leslie aporta mensaje y cuatro adjuntos PAGOS-01/02/CORR-01/CAJA-01. [Revisión de contratos](reservas-contrato-pagos-revision.md) distingue implementación reportada, confirmaciones históricas atribuidas por Shirley y propuestas nuevas. Su rama feature/PAGOS-02-aprobar-comprobante es local según reporte, HEAD 4e6bbf7 con cambios adicionales sin commit; no se certifica código privado ni prueba productiva con Bookings. L-01: acreditación previa al total aceptado propuesta, respuesta de Leslie pendiente; L-04/L-05: versión, contexto autorizado, corrección y caja sin contrato final. Corregir en los borradores de pagos las alusiones desactualizadas a ventanas 3/15 y efectivo como totalmente sin decidir frente a PR #35. Solo notas documentales propias, sin tocar adjuntos/implementación de Shirley, pruebas, migraciones, dependencias o Git de publicación.
### Acreditación: confirmación de Leslie, 2 de noviembre de 2026

Respuesta humana en este chat: «Sí, verificar antes del total aceptado». Se acepta la propuesta de Shirley de acreditar antes de que el comprador acepte el total y pague. Una estimación anterior no equivale a resumen final aceptado ni autoriza pago con beneficio sin verificar. Esta confirmación reemplaza el pendiente sobre el momento de acreditación; siguen pendientes autoridad verificadora, evidencia, registro y acceso privado. No autoriza una integración ficticia ni acredita implementación. Los demás acuerdos de versiones, correcciones y efectivo propuestos siguen pendientes.
## L-01: tabla de ejemplos preparada — 2 de noviembre de 2026

Leslie solicita completar la tabla, sin implementar cálculo. [Tabla propuesta](reservas-cotizacion-ejemplos.md), enlazada en BOOK-05-L01: 24 casos monetarios, edades, empates, acreditación, hojas, redondeo por pasajero y datos inválidos. Los 24 exactos/totales se contrastaron con aritmética entera/racional y decimal independiente; seis edades y suma por pasajero comprobadas. No son pruebas del módulo ni acreditan proveedores reales. No se cambió passenger-quote.js, sus pruebas ni la política histórica implementada. Sin lint/Jest/PostgreSQL/arranque al ser documentación; quedan revisión de tabla, desglose, acreditación, fechas ambiguas, total cero y techo de total antes de autorizar cálculo nuevo. Sin commits ni integración.
## Preparación de archivos para Shirley — 2 de noviembre de 2026

BOOK-06-L04 y BOOK-07-L05 incorporan el estado actual de confirmaciones y pendientes, incluidos los cambios sin commit posteriores a c7ceed9. Shirley propone conciliar primero findForPayment; no hay autorización nueva de implementación. Se preparan dos copias documentales para intercambio manual y ZIP, cotejadas con los originales; no copia del proyecto ni modificación de Git. API de pagos de Bookings sigue pendiente. La propuesta de consecuencia al vencer corrección de 15 minutos no queda aprobada por enviar archivos. Sin mensaje externo ni pruebas funcionales en esta sesión documental.
## L-05: propuesta de lectura autorizada preparada — 2 de noviembre de 2026

Leslie pide avanzar en la propuesta mientras Shirley responde. [Contrato propuesto findForPayment](reservas-find-for-payment-propuesta.md), enlazado en BOOK-07-L05: firma/contexto, matriz de permisos, DTO y errores con 20 ejemplos previstos. Registra cambio explícito del puerto antiguo sin contexto, límites de estados/datos reales y efectos de lectura nulos; no permiso por UUID, rol de body o tenant elegido. No implementado ni aprobado por Shirley. Revisar contrato antes del incremento de código; no migraciones/dependencias ni pruebas funcionales en esta preparación. Los archivos de intercambio anteriores para Shirley conservan su contenido previo y no se sobrescriben con una nueva versión sin avisar.
## L-05: respuesta técnica a conciliación de Shirley — 2 de noviembre de 2026

Revisados los dos contratos recibidos; versión consolidada sustituye su primera firma de un objeto. Se comprueba estáticamente que createdAt es el mismo startedAt con el que se calcula expiresAt en creación local, sin nueva ejecución de pruebas. Se propone minimizar ownerId a carga y, ante falta de recepción persistida, primer lector base sin canUploadProof, sin datos de recepción inventados y sin habilitar carga productiva. Requiere confirmación de Shirley; Auth/contexto y errores con Pablo, más autorización posterior de implementación. Detalles en reservas-find-for-payment-propuesta.md §12 y BOOK-07-L05. Otros pendientes de pagos conservados; no se crea otra ronda de decisiones sobre reglas ya confirmadas. Solo documentación, sin código, pruebas, migraciones, dependencias o Git de publicación.
## Conciliación con PR #46/#47 y decisión de corrección — 2 de noviembre de 2026

Fetch: origin/develop 1dcbd6d. GitHub confirma PR #46 (contrato) y #47 (bandeja/adaptador consumidor) integradas. Se leyó contrato publicado: proofWindowStartedAt y duración explícitos, recepción aceptada persistida, DTO con canUploadProof, contexto userId/role/cooperativeId y códigos seleccionados. El lector reducido local sin booleano queda superado como propuesta de compatibilidad; falta spec de persistencia y conformidad, no otra aceptación genérica del diseño seleccionado por delegación reportada.

Leslie confirma expresamente en este chat: cerrar edición al vencer 15 minutos y mantener revisión/asientos, sin rechazo/liberación automáticos. Los demás detalles de corrección y mutaciones siguen pendientes. [Conciliación de once puntos](reservas-pagos-conciliacion-20261102.md) registra contratos vigentes, propuestas, responsables y objetivos de fechas no comprometidos. Rama local c7ceed9 sin integrar remoto; proveedor aún no implementado. No pruebas funcionales nuevas, código, migraciones, dependencias, commits o publicación. Las copias ya preparadas para Shirley son instantáneas anteriores.
## Incremento técnico persistencia/lector preparado — 2 de noviembre de 2026

[BOOK-07-L05-T1](specs/BOOK-07-L05-T1.md), borrador completo para autorización, concreta migración nueva, creación atómica y API de lectura de PR #46; 18 grupos de aceptación previstos, sin pruebas ejecutadas ni implementación. Define tratamiento seguro de historia desconocida y restricciones/reversión sin editar migraciones antiguas. origin/develop actualizado a 1daa3c4; PR #49 de viajes comprobada integrada. Rama local conserva c7ceed9 y cambios documentales; no integración/publicación. No se reabre el contrato seleccionado ni se atribuye aprobación de este esquema técnico. Próximo paso: autorizar pasos A–C e implementar con PostgreSQL aislado, lint/formato/suite y arranque real.
## L-05 A–C: lector y persistencia verificados localmente — 2 de noviembre de 2026

Autorización expresa de Leslie en este chat. [BOOK-07-L05-T1](specs/BOOK-07-L05-T1.md) y [guía/evidencia](reservas-lector-pagos.md): migración nueva 1793740000000, nuevas reservas con plazo/ausencia conocida atómicos, historia UNKNOWN, protección de hechos y lector paymentQueries.findForPayment real. Código en feature/BOOK-03-resumen-creacion-dominio sobre c7ceed9, sin commit/PR ni integrar develop.

npm run lint aprobado. npm test final: 839 unitarias + 206 integraciones = 1045 aprobadas, 68 suites; 84 pruebas nuevas incluidas. Arranque real y sesión/revocación comprobados. Consumidor de PR #47 leído de Git en memoria y PostgreSQL aislado: nueve comprobaciones aprobadas, sin conectar rutas productivas ni copiar proyecto. Formato de 10 JS del incremento aprobado; format:check global sigue fallido en 24 archivos ajenos. Prueba previa de reversión ahora alcanza su migración por nombre conservando aserciones; primer fallo documentado y repetición global aprobada. No pruebas borradas/omitidas ni timeouts ampliados.

Entorno QA exclusivo busesuta-leslie-lector, PostgreSQL 16.13 inicialmente sin tablas, Node 24.21.0; sin .env/cuentas reales/dependencias nuevas. Retirada confirmada: contenedor y red busesuta-leslie-lector eliminados, sin recursos propios restantes. Recepción/expiración real, venta/liberación, rutas Payments, cotización/proveedores de compra y revisión humana siguen pendientes; no declarar integración/cierre o compra comercial completa.
## Checkpoint de commit y siguiente borrador — 2 de noviembre de 2026

Leslie pide continuar y avisar cuándo guardar un commit. Se informa que el lector/persistencia de BOOK-07-L05-T1 está listo para commit local con mensaje sugerido feat(reservas): agrega lectura autorizada para pagos; no se hace stage, commit o push. [Recepción/expiración T2](specs/BOOK-06-L04-T2.md) preparado como borrador con bloqueos/resultados/pruebas. Autoridad de operación durable y estado EXPIRED compatible con consumidor requieren contrato específico con Pablo/Shirley; no inventar un SERVICE ni usar contexto del lector para escribir. Sin cambios funcionales desde las 1045 pruebas aprobadas; no se repiten por estos cambios Markdown. Rama/HEAD conservados, develop consultado 1daa3c4.

### Conciliación documental de Pagos — 2 de noviembre de 2026

- Se leyeron íntegros los dos adjuntos de Leslie y el código actual de lectura/carga/listado, y se comprobó el remoto con GitHub sin incorporar commits a la rama local. Su rama `feature/BOOK-03-resumen-creacion-dominio` no apareció publicada; `c7ceed9` y los borradores posteriores son procedencia reportada, no código inspeccionado de esa rama.
- Leslie confirmó acreditar antes del total aceptado/pago; quién verifica, documentos y registro siguen pendientes. Conserva recepción–expiración, venta idempotente y rechazo justificado. Versiones, importe observado, vencimiento de corrección, caja e invitado siguen con los pendientes expresos de sus adjuntos.
- Pablo aceptó revisar PAGOS-02/03/CORR-01/CAJA-01. Correo e invitado son propuestas de contrato todavía por completar; PDF/JPEG/PNG es su recomendación, no una ratificación atribuida a Shirley por copiar un borrador de respuesta. El máximo de 5 MiB sí consta confirmado.
- Resultado verificable de esta entrega: contrato de lectura propuesto con contexto, DTO, errores y ejemplos; referencias en PAGOS-01/02 y conciliación de CORR-01/CAJA-01. Aceptación humana y código pendientes. El trabajo planificado para el 1 de noviembre no se marca cerrado ni se retrofechan las respuestas del 2.
- Se recibió después la propuesta concreta de Leslie con 20 escenarios y se consolidó el documento principal para no mantener dos contratos activos incompatibles. Se recomienda su firma de dos argumentos y clasificación de integridad 500/temporal 503. Pendientes concretos: contexto Auth, minimización de ownerId, createdAt como inicio del plazo y soporte real de ausencia de recepción con el esquema actual. El listado de Payments necesita adaptación de nombres/contexto/errores, todavía sin ejecutar.
- Verificación documental de la segunda conciliación: `git diff --check` aprobado; 59 enlaces locales de seis documentos sin destinos inexistentes. Los SHA-256 de los 20 archivos backend con cambios previos/no seguidos se conservaron idénticos; no se modificaron frontend ni pruebas. No se ejecutan lint, formato de JavaScript, PostgreSQL ni pruebas funcionales por un cambio solo documental. Los 20 escenarios del contrato son pruebas futuras, no resultados ejecutados.

### Preparación local de revisión PAGOS-02 — 2 de noviembre de 2026

- Se volvieron a consultar ramas/PR y develop por GitHub: develop `8fdf7e4`; la colección de PR abiertas solo devolvió #44 de Fleet, sin PR abierta de PAGOS-02. La base común pública `518c46b` permite contrastar los cambios remotos; la comparación con HEAD local no publicado devolvió 404. No se incorporó develop ni se sustituyó trabajo existente.
- Se repitió `npm test` completo: 594 unitarias y 120 integraciones aprobadas con PostgreSQL 16.13 temporal exclusivo. El primer intento restringido tuvo seis fallos HTTP EACCES; la repetición permitida pasó sin cambiar pruebas. Lint y formato propio (28 JS) aprobados; formato global fallido en 48 archivos ajenos. Arranque real de server.js: health 200 y listado/aprobación sin sesión 401; recursos temporales retirados.
- Se registraron resultados y [borrador de PR](evidence/PAGOS-02/2026-11-02-preparacion-pr.md) en PAGOS-02 §15. Esta preparación no aprueba lectura/mutaciones nuevas ni acredita venta productiva o integración. Solo se editaron documentación y evidencia; código, pruebas, migraciones y dependencias conservados. Sin commits, push, merge, rebase, tags ni envío de mensajes.

### Respuesta de Pablo y pruebas HTTP independientes — 2 de noviembre de 2026

- Respuesta humana adjunta de Pablo leída completa y registrada en el contrato principal: origen Auth y matriz confirmados; proyección mínima y códigos nuevos propuestos. Formatos PDF/JPEG/PNG y 5 MiB ratificados. AUTH-INVITADO-01, CORREO-01 y AUTH-06 son borradores locales reportados; no se inspeccionaron ni se inventó su publicación o disponibilidad.
- Nuevo archivo de integración de Payments con 14 casos HTTP, Auth y PostgreSQL reales: aislamiento de cooperativas, sesión/roles/CSRF, bytes privados, intención/actor, repetición, concurrencia y respuesta perdida. Reservas continúa simulado; no se cambió producción, migraciones, dependencias, pruebas previas o sus límites. Los 20 archivos backend previos conservan sus SHA-256.
- Prueba dirigida: 14/14 aprobadas. Primera ejecución global: 594 unitarias aprobadas y salida 1 durante integración sin detalle final, causa no determinada. Repetición de integración: 134/134 aprobadas. Repetición final de npm test con salida conservada: 594 unitarias + 134 integraciones (728 total), salida 0. Lint y formato propio de 29 JS aprobados; formato global fallido en 48 archivos ajenos. PostgreSQL temporal exclusivo retirado.
- GitHub: develop continúa en `8fdf7e4`; PR abiertas #44 y #45, ninguna de PAGOS-02. No se incorporó esa base ni se certifica combinación. [Evidencia](evidence/PAGOS-02/2026-11-02-integracion-http.md) y borrador de PR actualizados. Sin commits, push, merge, rebase, tags, aprobación humana de implementación ni cierre de tarea.

### Adaptador consumidor y descripción detallada de PR — 2 de noviembre de 2026

- GitHub: PR #45 integrada, develop `3d053a4`; PR #46 abierta y fuera de borrador, APPROVED por Shirley sobre `ad74d25` para su diseño/documentación. La comparación desde `518c46b` registra 80 commits remotos posteriores y cambios de composición/docs, sin cambios backend de Payments. No se incorporó ni verificó esa combinación; sin PR abierta de PAGOS-02.
- Se registró §17 en PAGOS-02 antes de implementar tres archivos nuevos: error de consulta, adaptador por API pública inyectada y suite de 74 pruebas. No se conectó a rutas ni se modificaron casos de uso/composición; no se inventan proveedor o recepción. Los 20 archivos backend premodificados conservan sus hashes; tampoco se editó la suite HTTP anterior.
- Lint aprobado; formato propio de 32 JS aprobado; formato global fallido en los mismos 48 archivos ajenos. Suite dirigida 74/74. `npm test` completo con PostgreSQL temporal exclusivo: 668 unitarias + 134 integraciones, 802 total, salida 0; contenedor retirado. Arranque real anterior conserva alcance: no se repite por este adaptador no conectado.
- [Evidencia del incremento](evidence/PAGOS-02/2026-11-02-adaptador-lector.md) y [descripción detallada de PR](evidence/PAGOS-02/descripcion-pr.md). Revisor principal Pablo confirmado; Leslie revisión complementaria propuesta, sin segunda aprobación obligatoria inferida. Proveedor/conexión, contratos de mutaciones, revisión humana y combinación con develop pendientes. Sin commits, push, merge, rebase, tags o publicación.
- Comprobación final: PR #46 pasó a `782f54a` con conciliación documental, sin cambiar el contrato del lector de `ad74d25`. No se atribuye aprobación nueva al commit posterior. `git diff --check` aprobado; 89 enlaces locales de diez documentos sin destinos inexistentes, sin validar anclas/URLs externas.
- Preparación de selección para publicación: PAGOS-CORR-01 y PAGOS-CAJA-01 permanecen como archivos locales separados. Sus filas se conservan sin enlaces a specs que no se incluirán en la PR de PAGOS-02. Los comandos propuestos seleccionan rutas concretas; no se ejecutó staging, commit o publicación en esta preparación.


## Leslie: resolución de conflictos de PR #51 — 2 de noviembre de 2026

PR [#51](https://github.com/Pato77232/ProyectoBusesUTA/pull/51), rama feature/BOOK-03-resumen-creacion-dominio, hacia develop, en borrador. Leslie autoriza incorporar develop 5abc36d en su rama publicada 67b333b y guardar/publicar la resolución. Once conflictos resueltos preservando módulos, suites, contratos y evidencia de ambos lados; no merge de PR hacia develop.

BOOK-07-L05-T1 conserva alcance A–C. Lint backend/frontend aprobados; 1572 unitarias backend y 181 pruebas frontend aprobadas; Nginx real, ocho grupos Chrome y nueve comprobaciones con consumidor Payments aprobados. Integración global 459/462 antes de ajustar dos pruebas de reversión, verificadas después; persiste timeout de fotografías de Fleet. Formato global: 17 archivos ajenos pendientes. No declarar suite global aprobada.

Base previa de develop: actualización bloqueada por orden de migración create-bookings; historia intacta. Requiere estrategia no destructiva acordada con Pablo antes de desplegar. No se editaron migraciones ni se debilitaron expectativas/timeouts. [Evidencia y siguiente incremento propuesto](evidence/BOOK-07-L05-T1/2026-11-02-conciliacion-pr51.md). Contenedor/red/bases temporales retirados; revisión humana de Pablo/Shirley pendiente. Los registros anteriores de «sin PR» o «develop no incorporado» conservan su fecha histórica y quedan supersedidos por esta actualización.


## Leslie: desbloqueo de migraciones de PR #51 — 3 de noviembre de 2026

| Spec / área | Estado comprobado | Evidencia y límite |
| --- | --- | --- |
| BOOK-07-L05-T1, catálogo de migraciones | Implementado y probado en la rama feature de PR #51; revisión humana pendiente | [Evidencia](evidence/BOOK-07-L05-T1/2026-11-03-catalogo-migraciones.md). Originales intactos, nueva entrada 1793820000000 posterior a develop, catálogo explícito y rechazo previo de historia heredada/desconocida. Base vacía y esquema de develop con datos conservados; rollback y bloqueo reales. |

HEAD inicial 901d308 limpio; origin/develop contrastado en 2df5949 con las mismas 17 migraciones. No se incorpora incidentalmente su código posterior de Auth. Repetición completa final: 1588 unitarias + 474 integraciones = 2062 aprobadas, 116 suites; arranque real incluido. Última comprobación dirigida 28/28 y lint aprobados; formato propio aprobado, formato global pendiente en 17 archivos ajenos. Timeout anterior de fotografía conservado como incidencia; prueba aprobada finalmente sin cambios ni ampliación de tiempo. Primera regresión de historial vacío corregida y verificada, sin debilitar aserciones.

Leslie autoriza commit/publicación solo en su rama y actualización de descripción; PR en borrador, sin merge a develop ni aprobación humana inferida. Bases persistentes no consultadas: cualquiera con originales aplicados requiere un plan aparte y se rechaza sin conversión. No cambia la disponibilidad de recepción/venta/liberación ni proveedores comerciales pendientes.

Limpieza confirmada: bases catalog_<UUID>_test retiradas por sus fixtures; contenedor y red busesuta-leslie-migraciones eliminados al terminar. Sin recursos propios restantes ni cambios a los demás servicios Docker.


## Leslie: conciliación de PR #51 con Auth/VIP — 3 de noviembre de 2026

Rama feature/BOOK-03-resumen-creacion-dominio desde 4e252c1, incorporando develop 04868b2 por autorización de Leslie. Único conflicto textual en este registro: se conservan evidencias de ambos lados. Catálogo activo actualizado a 19 entradas (18 de develop + instalación de Reservas), manteniendo exclusión exacta de originales y validación estricta.

[Evidencia](evidence/BOOK-07-L05-T1/2026-11-03-conciliacion-vip.md): 29 comprobaciones dirigidas de catálogo; 1614 unitarias + 493 integraciones = 2107 backend aprobadas, 122 suites, con arranque real. Frontend lint y 181 pruebas aprobados. Lint y formato propio aprobados; formato global pendiente en 17 archivos ajenos. Se verifica conservación de asiento VIP en la copia de develop actual y actualización con datos de la base anterior de 17 migraciones.

Código de Auth/Fleet y migraciones de ambas partes conservados, sin adaptar incidentalmente cotización o proveedores de compra. Resolución para revisión de Pablo/Shirley, sin autoaprobación ni merge hacia develop. Los registros anteriores mantienen su alcance histórico.


## Leslie: revisión humana y siguiente incremento — 3 de noviembre de 2026

GitHub comprobado: PR #51 abierta, fuera de borrador y sin integrar, f0a9c2f; PabloToapanta APPROVED el 3 de noviembre, Shirley solicitada. No se marca integrada/cerrada ni se modifica esa rama publicada. Origin/develop 517473d contiene documentación nueva de Fleet; PR #55/#56 de lectura de Pagos y #59 de Fleet siguen abiertas.

Preparación local separada: feature/BOOK-06-recepcion-expiracion desde f0a9c2f, sin publicar. BOOK-06-L04-T2 continúa en borrador de contrato. [Propuesta concreta](contratos/recepcion-reservas-pagos-propuesta.md): puerto interno ligado a consulta persistida de Payments, outcomes recuperables y compensación restringida, compatibilidad de EXPIRED y matriz de carreras/fallos. Tres decisiones compartidas pendientes; no se implementan comandos por la aprobación del lector.

Se detectan dos adaptaciones necesarias del consumidor actual: no marcar entregado cualquier resultado resuelto y no borrar evidencia por errores de vínculo/fuente/timeout. No se modifica el código de Shirley. Cambios únicamente Markdown; validación documental propia, sin nuevas pruebas funcionales ni resultados reutilizados como integración de este borrador. Sin commits, push, merge de PR, tags, dependencias o lectura de secretos.


## Leslie: recepción y expiración locales — 3 de noviembre de 2026

| Spec / área | Estado comprobado | Evidencia y límite |
| --- | --- | --- |
| BOOK-06-L04-T2, incremento B | Implementado y probado localmente en feature/BOOK-06-recepcion-expiracion desde f0a9c2f; sin commit/publicación ni revisión humana | [Spec](specs/BOOK-06-L04-T2.md), [evidencia](evidence/BOOK-06-L04-T2/2026-11-03-recepcion-expiracion.md). Primera recepción y expiración serializadas, resultado durable, rollback y recuperación tras respuesta perdida. Fuente externa QA persistida, no conexión productiva con Payments. |

Leslie delegó escoger el diseño y continuar; no se inventa aprobación individual de Shirley/Pablo. Esta actualización sustituye el estado de preparación solo documental anterior. Origin/develop contrastado en 1a411ef, sin incorporación; PR #51 y su rama publicada no cambian.

npm test completo: 1657 unitarias y 514 integraciones aprobadas (2171, 124 suites), con arranque real. Caso posterior adicional de dos expiradores simultáneos + catálogo: 38/38 dirigidas. Lint y formato propio aprobados; formato global mantiene 17 archivos ajenos. Frontend lint y 181 pruebas aprobados. Fotografías pasó sin ampliar timeout ni cambiar expectativas. Contenedor/red exclusivos retirados, sin tocar servicios ajenos.

Compatibilidad de lectura EXPIRED con carga deshabilitada implementada en lector y adaptador preparado. C sigue pendiente: fuente pública real de Payments, autorización inicial UPLOAD_PROOF y adaptador que interprete outcomes/compensación. D sigue pendiente: planificador y recuperación de candidatos. Venta, rechazo, correcciones, caja e invitado separados. Este resultado no certifica compra completa ni integración.

Leslie autoriza posteriormente el commit y push de BOOK-06-L04-T2 en su rama feature/BOOK-06-recepcion-expiracion. La autorización no incluye merge ni acredita revisión humana de este incremento.


## Leslie: corrección de conflicto de PR #51 con Pagos Web — 3 de noviembre de 2026

| Spec / área | Estado comprobado | Evidencia y límite |
| --- | --- | --- |
| BOOK-07-L05-T1, conciliación de PR #51 | Conflicto resuelto en feature/BOOK-03-resumen-creacion-dominio, incorporando develop 1a411ef desde f0a9c2f; publicación autorizada | [Evidencia](evidence/BOOK-07-L05-T1/2026-11-03-conciliacion-pagos-web.md). Se conservan test/lint y comprobadores de Reservas/Pagos, sin migraciones ni negocio nuevos. No integra la PR. |

Backend: lint y 2108 pruebas aprobados (1615 unitarias + 493 integraciones, 123 suites), con arranque real. Frontend: lint y 205 pruebas aprobados; Nginx con recursos de ambas pantallas y ocho grupos Chrome de Reservas aprobados. Formato propio aprobado; global mantiene 17 archivos ajenos. Fotografías sin cambios y aprobadas. Recursos QA exclusivos retirados.

PR #51 abierta y Ready for review; se verificaron aprobaciones anteriores de Pablo y Shirley, sin atribuirlas al commit de resolución. La rama feature/BOOK-06-recepcion-expiracion continúa intacta en 4233811. Conexión productiva de Pagos y comandos nuevos siguen separados; no se declara compra completa ni cierre.


## Leslie: BOOK-06-L04-T2 actualizado con develop — 3 de noviembre de 2026

| Spec / área | Estado comprobado | Evidencia y límite |
| --- | --- | --- |
| BOOK-07-L05-T1 / PR #51 | Integrada por Leslie en develop mediante 5a40702, 17:48:31Z, comprobado en GitHub | Los registros anteriores conservan su alcance histórico. No implica aprobación del incremento B de recepción. |
| BOOK-06-L04-T2, incremento B | Publicado inicialmente en 4233811; combinación con develop 5a40702 resuelta y probada, publicación autorizada para preparar PR | [Spec](specs/BOOK-06-L04-T2.md), [evidencia](evidence/BOOK-06-L04-T2/2026-11-03-actualizacion-develop.md), [descripción](evidence/BOOK-06-L04-T2/descripcion-pr.md). Sin PR nueva ni revisión humana acreditadas. |

Único conflicto en este registro, conservando ambas evidencias. Catálogo de 20 entradas; originales y código productivo de B intactos. Regresión nueva de actualización desde las 19 migraciones integradas con reservas/plazos/ocupaciones conservados.

Backend: lint y 2173 pruebas globales aprobadas (1658 unitarias + 515 integraciones, 125 suites), con arranque real; catálogo ampliado posterior 14/14 dirigido. Frontend lint y 205 pruebas, Nginx y ocho grupos Chrome aprobados. Formato propio aprobado; global mantiene 17 archivos ajenos. Fotografías sin cambios y aprobadas; bases/contenedores/redes propios retirados.

Diff de la nueva PR limitado a recepción/expiración. C sigue pendiente (fuente real de Payments, autorización inicial y compensación segura); D sigue pendiente (planificador/recuperación). No se declara compra comercial completa, revisión humana ni integración de B.


## Leslie: adaptador seguro de aviso de Payments — 3 de noviembre de 2026

| Spec / área | Estado comprobado | Evidencia y límite |
| --- | --- | --- |
| BOOK-06-L04-T2 / PR #60 | Integrada en develop b4fe717 a las 19:07:02Z, comprobado por GitHub | Recepción/expiración internas integradas; C y D conservan sus pendientes. |
| BOOK-06-L04-T3, C1 | Implementado/probado localmente en feature/BOOK-06-adaptador-aviso-pagos desde b4fe717, sin commit/push/PR ni revisión humana | [Spec](specs/BOOK-06-L04-T3.md), [evidencia](evidence/BOOK-06-L04-T3/2026-11-03-adaptador-aviso.md). Adaptador público de resultados de Bookings para Payments, sin activar servidor/rutas. |

PR #55 ca63a36 y #56 15218ae de Shirley siguen abiertas, comprobadas directamente; no se duplica su lector ni su prueba. C1 preserva ACCEPTED y solo convierte REJECTED_EXPIRED vinculado en el error existente de plazo. Fallos, clases genéricas de rechazo, vínculos distintos y resultados inválidos conservan incertidumbre sin autorizar borrado.

Primera global: 1688 unitarias + 521 integraciones = 2209 aprobadas, 127 suites, con arranque real. Repetición final tras captura única: todas las unitarias 1689/1689 y cinco integraciones propias 5/5. Casos nuevos: 31 unitarias + cinco integraciones. Lint y formato propio aprobados; global conserva 17 archivos ajenos. Fotografías aprobadas sin cambios; PostgreSQL/red exclusivos retirados.

Fuente QA persistida en pruebas; no procedencia Auth de la carga ni conexión productiva. C2 (fuente pública de Payments y autorización inicial), C3 (composición real y compensación), D (planificador), venta/rechazo/correcciones/caja/invitado siguen separados. Sin nuevas dependencias o migraciones ni pruebas debilitadas. Commit/publicación y revisión humana pendientes; no se marca C1 integrada.

Leslie autoriza posteriormente guardar y publicar C1 de BOOK-06-L04-T3 en feature/BOOK-06-adaptador-aviso-pagos. La autorización no incluye integrar la PR ni activar la conexión productiva.


## Leslie: conciliación de PR #62 con el puente integrado — 3 de noviembre de 2026

| Spec / área | Estado comprobado | Evidencia y límite |
| --- | --- | --- |
| BOOK-06-L04-T3 / PR #62 | Tres conflictos resueltos en feature/BOOK-06-adaptador-aviso-pagos, combinando 4030709 con develop 61fd65a | [Spec](specs/BOOK-06-L04-T3.md), [evidencia](evidence/BOOK-06-L04-T3/2026-11-03-conciliacion-pr62.md). Un puente compartido, ambos contratos conservados; revisión humana pendiente, sin integrar PR. |

Develop ya incorpora la fuente persistida/createPaymentReceiptModule de Shirley (9131787); la conciliación los conserva y reutiliza. Fábrica de Leslie como fachada, captura inmutable y clasificación segura. Ambas suites originales conservadas byte a byte; siete regresiones adicionales. Sin cambios de fuente SQL, migraciones, rutas, servidor, dependencias o frontend.

Pruebas propias dirigidas: 66 unitarias y 14 integraciones aprobadas. Global: 1724 unitarias aprobadas y 529/530 integraciones; fallo de Fleet por timeout original de 20000 ms en fotografías. Repetición aislada: 17/18, mismo fallo. No declarar suite global aprobada. Lint/formato propio aprobados; global mantiene 17 ajenos. Arranque real aprobado; contenedor/red temporales retirados.

La fuente persistida está preparada, pero la autorización HTTP de carga, procedencia histórica, activación productiva y planificador conservan sus pendientes. Revisión del commit de conciliación y evaluación del fallo de Fleet necesarias antes de integrar.
