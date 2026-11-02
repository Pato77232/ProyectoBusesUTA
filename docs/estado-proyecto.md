# Estado compartido del proyecto

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

- **Fecha de comprobación:** 1 de noviembre de 2026, America/Guayaquil.
- **Base integrada examinada:** origin/develop 0b4041e, actualizada mediante fetch; PR #33 integra ROUTE-SHEETS-02 y conserva T3d. AUTH-WEB-01 no está integrada.
- **Cambio local actual:** AUTH-WEB-01 conexión a API en feature/AUTH-WEB-01-login-integracion. Coordinación de Fleet guardada aparte en f5a6fbe; plan/visual previos 1d7e0db/ffbe32b locales.
- **Alcance:** base frontend y dependencias de Pablo/Edwin; otras filas conservan sus fuentes históricas, sin certificar todo el sistema.
- **Fuentes:** árbol y composición de esa base, specs versionadas y distribución de referencia en [equipo-y-acuerdos.md](equipo-y-acuerdos.md). No se inspeccionaron todas las ramas remotas ni se certifica el trabajo privado de otros integrantes.

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
| AUTH-BOOTSTRAP-01 | Pablo | Trabajo en rama local, fuera de develop | Corrección del pegado de contraseña en `9b65e9f`; 98 pruebas aprobadas en su rama. Publicación/revisión/integración pendientes; no rehacer la tarea |
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
| [AUTH-WEB-01](specs/AUTH-WEB-01.md) | Pablo; revisión por confirmar | Plan documentado; producto en incrementos separados | Base 0b4041e; procedencia local 1d7e0db/ffbe32b. Guardado de T2 autorizado; no implica integración ni publicación. |
| [FLEET-05](specs/FLEET-05.md) | Edwin | T1 en división: T1a y T1b reemplazan a PR #31, en borrador | Formulario sin API. Pablo integró T3c/T3d y propuso que Edwin haga multipart y proxy como T2; decisión en la spec. T3 espera el login. |
| search, bookings, payments y tickets | Según propuesta inferior | Sin implementación en la base examinada | Confirmar ramas de los responsables antes de crear tareas |
| [PAGOS-01](specs/PAGOS-01.md) | Shirley | En desarrollo; T4 verificada localmente, revisión humana pendiente | Base `origin/develop` `e556e59`; lint y formato de sus archivos aprobados; 41 suites/564 unitarias y 13 suites/116 de integración aprobadas. `bookings` sigue simulado conforme al alcance T4. |
| CI | Pablo | Sin workflow versionado en la base | Proponer una spec propia; no afirmar protecciones remotas sin consultarlas |

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
| Pablo | 2. Preparar publicación/revisión de AUTH-BOOTSTRAP-01 | Corrección local verificada en 9b65e9f; comprobar integración con develop antes de cerrarla |
| Pablo | 3. Completar AUTH-WEB-01 y su revisión por incrementos | T3d integrada. Conexión de login local; cerrar evidencia y preparar entregas pequeñas. Navegación pendiente; coordinación Fleet en f5a6fbe, sin aceptación inferida de multipart/proxy. |
| Pablo | 4. Crear endpoint de alta de oficinista | Acordar quién lo autoriza y alcance con Shirley; no inferir permisos |
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
| Shirley | 1. Acordar ciclo reserva–comprobante con Leslie | Inicio del plazo, transición y límites; no fijar duración en el código |
| Shirley | 2. Subir comprobante y luego listar pendientes, en tareas separadas | Contrato de reserva, archivos y cuenta CLERK operativa |
| Shirley | 3. Aprobar y rechazar comprobante, en tareas separadas | RN-52/53, aislamiento y concurrencia; rechazo exige justificación |
| Shirley | 4. Emitir boleto QR y luego consultar historial, en tareas separadas | Aprobación, asiento vendido e identidad cliente/invitado acordados |
| Shirley | 5. Pantallas de comprobante y bandeja, una por tarea | Endpoints y base frontend |

Búsqueda consolidada todavía requiere asignación confirmada. La propuesta original permite apoyo de Pablo en búsqueda y Edwin en historial solo cuando terminen sus primeras tareas; no es una reasignación aprobada. No desatenderla por no tener responsable: acordarlo junto con el contrato de viajes.

## Acuerdos que desbloquean trabajo

| Tema | Participantes propuestos | Evidencia que falta |
|---|---|---|
| Buses/grupos/frecuencias para hojas de ruta | Edwin, David y Pablo para composición | Contratos públicos concretos y prueba del arranque real |
| Precio y ciclos | David, Leslie y responsable de búsqueda por confirmar | FREQ-01 decide precio por tramo, pero business-rules.md aún lo pregunta; ROUTE-SHEETS-01 agrega ciclos/ventana; reconciliar fuentes sin inventar otra regla |
| Descuentos y cédula | Leslie y equipo | Porcentajes, edades y forma de validación aprobados |
| Plazo y comprobante | Leslie y Shirley | Inicio del plazo, límites, transiciones y comportamiento concurrente |
| Invitado, tarjeta y venta física | Leslie, Shirley y equipo | Resolver preguntas abiertas de business-rules.md antes de implementar lo afectado |
| Frontend compartido | Pablo y autores de pantallas | Contratos de navegación, origen, mensajes y criterios de usabilidad |

Usar [equipo-y-acuerdos.md](equipo-y-acuerdos.md) para preparar la consulta y registrar la respuesta humana. Los defectos inducidos siguen sin definición concreta en el protocolo; no introducirlos por iniciativa propia.

## Evidencia de calidad

Resultados actuales de INFRA-04 se registran en su [spec](specs/INFRA-04.md). No confundir evidencia histórica de otras specs con una ejecución actual. Los fallos preexistentes se reportan sin corregirlos de paso ni declarar la entrega lista.

- FLEET-02, T2 del 31 de octubre: T1 guardado en 6123ca1 por petición de Edwin, sin push. Persistencia local implementada y 58 pruebas nuevas aprobadas; suite final completa con 715 unitarias y 164 integraciones aprobadas (879 total), lint aprobado. La ejecución previa tuvo 4 fallos por TRUNCATE de hojas de ruta; Edwin autorizó únicamente las listas de limpieza de tres suites de frecuencias y después la de hojas de ruta. Sin cambios a comprobaciones. Evidencia y límites en la spec; T3/T4 pendientes.

- FLEET-02, continuación T3 del 31 de octubre: Edwin autorizó publicar T1/T2 y continuar. T2 guardado en ebd547a; rama publicada y PR #27 en borrador hacia develop, dependiente de #26 aún abierta al consultar. T3 local implementa almacenamiento privado, promoción, compensación, preservación ante COMMIT incierto y diagnóstico CLI de solo lectura con procedimiento manual de recuperación en la spec. 36 pruebas nuevas aprobadas; suite completa con 724 unitarias y 191 integraciones (915 total), lint correcto. Prueba de dos contenedores consecutivos conserva bytes en volumen temporal. Formato global pendiente en los mismos 24 archivos; T4 sin implementar, sin cambios a pagos ni migraciones y sin publicación de T3.

- FLEET-02, T4 del 31 de octubre: Edwin autorizó continuar. Alta HTTP conectada al arranque con autenticación/rol/CSRF previos a leer el cuerpo, Busboy limitado y validación de extensión/MIME/decodificación con Sharp y cierre PNG completo. Dependencias exactas busboy 1.6.0 y sharp 0.35.5 anunciadas y justificadas antes de instalar, sin cambiar versiones existentes del lock. 70 pruebas nuevas T4; validación final 765 unitarias + 220 integraciones (985 total), lint aprobado. Imagen Docker de producción y conservación de foto/referencias/42 asientos al recrear contenedor verificadas en recursos aislados. Formato nuevo correcto y 24 pendientes anteriores. Sin cambios a pagos ni migraciones. T3/T4 locales, sin commit/push; PR #27 conserva T1/T2 en borrador, revisión humana e integración pendientes.

- FLEET-02, publicación del 31 de octubre: Edwin solicitó actualizar PR #27 para revisión con T3/T4. Incrementos separados en commits (T3: 36b9255), sin merge/rebase. PR #26 comprobada integrada y origin/develop en 4937892; esa dependencia queda resuelta. Evidencia final de 985 pruebas y Docker conservada en la spec. Se prepara PR lista para revisión, sin aprobación humana ni cierre de la tarea.

- PR #27 comprobada después de publicar: T3 36b9255 y T4 369af70 en GitHub, fuera de borrador, REVIEW_REQUIRED y sin checks CI registrados. GitHub detecta conflictos con develop en backend/src/server.js y docs/estado-proyecto.md; no se ejecutaron merge/rebase ni se conciliaron cambios de otros módulos. Integración pendiente; las 985 pruebas verifican la rama de Fleet, no una combinación aún no realizada.

### Comprobación de Fleet solicitada por Edwin, 31 de octubre de 2026

Fetch completado; HEAD de feature/FLEET-04-consulta-buses coincide con origin/develop en 4f34748. Se conservaron los cambios locales T1 sin commit; no hubo checkout, merge, rebase, stash, commit ni push. PR #27 integrada y aprobada por David22x; PR #28 sigue abierta, MERGEABLE y REVIEW_REQUIRED, cabeza 08b7526. Contiene restauración de env, cambios de convenciones de ramas y formato de un router; requiere revisión de todo su alcance antes de integrar. La suite completa de esa PR se documentó antes del último commit de formato, no después.

Siguiente paso de Fleet: resolver la revisión/integración humana de PR #28 y luego validar/guardar/publicar el T1 local de FLEET-04. Su T2 requiere acuerdo con David sobre BusSummary, pertenencia al grupo y error correspondiente. FLEET-05 ya tiene T1 en otro worktree; coordinar transporte/proxy/login con Pablo antes de T2/T3. Para Leslie aún falta especificar y publicar la consulta de los asientos ofrecidos de cada bus con sus UUID: FLEET-04 excluye asientos y FLEET-03 solo entrega plantillas. No se inventa ID para esa consulta ni se implementa en esta revisión. No se ejecutaron pruebas nuevas en esta consulta de Git/documentación; los conteos de las specs son evidencia histórica.

- FLEET-04, 1 de noviembre: Edwin pidió terminar y comunicó que David confirmó BusSummary y BUS_NOT_IN_ROUTE_SHEET_GROUP (409) en asignaciones/paradas. T2 implementado por API pública de Fleet, sin importar sus capas internas. 10 unitarias y 12 integraciones nuevas se suman a T1: 38 dirigidas aprobadas. Suite real: 786 unitarias aprobadas, integración 233 aprobadas/6 fallidas por el env perdido de PR #28. Suite con esa única corrección montada temporalmente: 786 + 239 aprobadas (1025), lint correcto. No se modificó server.js ni se incorporó la PR; 21 archivos previos pendientes de formato. T1/T2 locales, sin commit/push; revisión humana e integración pendientes. Evidencia detallada en la spec.

### Actualización de Fleet y develop, 1 de noviembre de 2026

Edwin pidió revisar el trabajo local y traer develop. PR #28 integrada en b1e6720; feature/FLEET-04-consulta-buses avanzó directamente a esa base manteniendo los cambios locales. Se resolvió solo el conflicto del registro compartido, preservando sus filas y quitando duplicados. Los archivos de código/pruebas de FLEET-04 se restauraron intactos. Validación real final: lint aprobado, 786 unitarias + 239 integraciones aprobadas (1025), sin montaje temporal; se resolvieron los seis fallos de fotos anteriores. Formato propio y diff --check correctos, formato global pendiente en 20 archivos previos. Sin commit ni push de FLEET-04.

Pendiente inmediato de Edwin: preparar commits y PR de FLEET-04, conseguir revisión humana e integrar/verificar. Después, FLEET-05 conserva T1 local en 00085d5; conectar transporte/proxy/login requiere coordinación con Pablo. Se observó la rama remota FRONT-01-T3c-cliente-http en 144f1f7, con cliente HTTP JSON, todavía fuera de develop y sin soporte multipart en esa implementación; no se incorporó ni se presupone revisión/aprobación. La consulta de UUID de asientos por bus para Leslie sigue necesitando spec separada; FLEET-04 no la incluye.

- FLEET-04 publicada por petición de Edwin el 1 de noviembre: T1 3ddfc26 y T2 782c4b0; PR #29 abierta hacia develop y lista para revisión, con base b1e6720, evidencia de 1025 pruebas aprobadas y limitación de formato global registrada. Sin aprobación humana del código, integración ni cierre inferidos.
