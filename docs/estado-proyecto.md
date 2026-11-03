# Estado compartido del proyecto

## Alcance y frescura de esta fotografía

- **Fecha de comprobación:** 29 de octubre de 2026, America/Guayaquil.
- **Base integrada examinada:** `origin/develop` en `e556e59`, actualizada mediante `git fetch origin`; incluye la corrección de rollback de Fleet `a78c750`, integrada en `4c1fbbd`.
- **Cambio local actual:** PAGOS-01 T4 en `feature/PAGOS-01-subir-comprobante-actualizado`, basada en la referencia actual. Lint, formato de los archivos propios, 41 suites/564 unitarias y 13 suites/116 pruebas de integración aprobadas. Publicación y revisión humana pendientes.
- **Alcance de esta actualización:** la evidencia específica de PAGOS-01 se comprobó hoy; las demás filas conservan las fechas y fuentes que indican.
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
| [FLEET-01](specs/FLEET-01.md) | Edwin | Código integrado, PR #10 | Crear/listar grupos; no hay registro de buses ni plantillas en la base examinada |
| [FREQ-01](specs/FREQ-01.md) | David, según distribución; spec aún «por asignar» | Código integrado; conexión al arranque pendiente | Existe módulo y montaje opcional en app.js; server.js no lo instancia |
| [ROUTE-SHEETS-01](specs/ROUTE-SHEETS-01.md) | David, según distribución; confirmar autor/responsable | Código integrado, PR #13; integración operativa pendiente | app.js admite routeSheets, pero server.js no lo instancia; la composición necesita contratos con fleet/frequencies/bookings |
| [INFRA-02](specs/INFRA-02.md), [INFRA-03](specs/INFRA-03.md) | Shirley; revisor indicado Pablo | Cambios presentes; cierre documental pendiente | cross-env y .gitattributes presentes, lock actualizado en historial; no implica aprobación humana ni validación Windows actual |
| [INFRA-04](specs/INFRA-04.md) | Pablo; revisora propuesta Shirley | Integrada: su código documental está contenido en c89b1b9 | La presencia en develop está comprobada; no se inventa evidencia de revisión humana/cierre |
| [FRONT-01](specs/FRONT-01.md) | Pablo; revisión humana por confirmar | T3a verificada desde develop; pendiente de revisión | Transporte JSON/errores; 17 contratos y lint frontend aprobados. Backend: lint y 657 pruebas aprobados; formato falla en 27 archivos previos. Cambio menor de 400 líneas. T3b–T3d se retomarán desde develop tras integrar sus dependencias. Avance completo anterior conservado; sección 27 de la spec |
| search, bookings, payments y tickets | Según propuesta inferior | Sin implementación en la base examinada | Confirmar ramas de los responsables antes de crear tareas |
| [PAGOS-01](specs/PAGOS-01.md) | Shirley | En desarrollo; T4 verificada localmente, revisión humana pendiente | Base `origin/develop` `e556e59`; lint y formato de sus archivos aprobados; 41 suites/564 unitarias y 13 suites/116 de integración aprobadas. `bookings` sigue simulado conforme al alcance T4. |
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
## Próximos pasos por integrante

Orden recomendado para discutir con el equipo. Cada fila es **Propuesta sin spec**, salvo la referencia a una tarea existente. Confirmar asignación y disponibilidad; las prioridades no son fechas comprometidas. Las pantallas se separan cuando su contrato está listo.

| Integrante | Orden y tarea pequeña propuesta | Dependencia / primer paso |
|---|---|---|
| Pablo | 1. Registrar la revisión/cierre de INFRA-04 cuando exista evidencia humana | Su contenido ya está en develop; no repetir implementación ni autoaprobar |
| Pablo | 2. Preparar publicación/revisión de AUTH-BOOTSTRAP-01 | Corrección local verificada en 9b65e9f; comprobar integración con develop antes de cerrarla |
| Pablo | 3. FRONT-01: revisar/guardar T2.4 y preparar revisión de T2 | T2.3 en cddbe34; guía/material de PR locales. Confirmar revisor y validación de la combinación con develop antes de integrar. Mantener límites de formato, IP y autenticación visibles; T3/T4 aún pendientes |
| Pablo | 4. Crear endpoint de alta de oficinista | Acordar quién lo autoriza y alcance con Shirley; no inferir permisos |
| Pablo | 5. Preparar CI y luego pantallas de acceso/cooperativas, una por tarea | Specs separadas; CI depende del entorno de integración, pantallas de la base frontend |
| Edwin | 1. Registrar un bus con los datos RN-10 | Spec y acuerdo de fotografías/almacenamiento; grupo de buses existente |
| Edwin | 2. Consultar buses de la cooperativa | Contrato público requerido por hojas de ruta; coordinar con David |
| Edwin | 3. Definir y consultar plantilla de asientos, en tareas separadas | Acordar identificadores, pisos y tipos con Leslie; RN-12 |
| Edwin | 4. Pantalla de registro y luego consulta de buses | Contratos anteriores y base frontend |
| David | 1. Resolver composición y contratos operativos de frecuencias/hojas de ruta | Coordinar con Pablo y Edwin; crear spec acotada; no importar capas internas |
| David | 2. Exponer consulta de viajes por fecha | Acordar Trip, ventana de compra y fuente del bus con búsqueda/reservas |
| David | 3. Pantalla de creación de frecuencia y luego listado/estado | Backend conectado y base frontend; specs separadas |
| David | 4. Pantalla de hoja de ruta manual | Contratos y pruebas de integración operativa resueltos |
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
