# Estado compartido del proyecto

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
| AUTH-BOOTSTRAP-01 | Pablo | Trabajo en rama local, fuera de develop | Corrección del pegado de contraseña en `9b65e9f`; 98 pruebas aprobadas en su rama. Publicación/revisión/integración pendientes; no rehacer la tarea |
| [FLEET-01](specs/FLEET-01.md) | Edwin | Código integrado, PR #10 | Crear/listar grupos; no hay registro de buses ni plantillas en la base examinada |
| [FREQ-01](specs/FREQ-01.md) | David, según distribución; spec aún «por asignar» | Código integrado; conexión al arranque pendiente | Existe módulo y montaje opcional en app.js; server.js no lo instancia |
| [ROUTE-SHEETS-01](specs/ROUTE-SHEETS-01.md) | David, según distribución; confirmar autor/responsable | Código integrado, PR #13; integración operativa pendiente | app.js admite routeSheets, pero server.js no lo instancia; la composición necesita contratos con fleet/frequencies/bookings |
| [INFRA-02](specs/INFRA-02.md), [INFRA-03](specs/INFRA-03.md) | Shirley; revisor indicado Pablo | Cambios presentes; cierre documental pendiente | cross-env y .gitattributes presentes, lock actualizado en historial; no implica aprobación humana ni validación Windows actual |
| [INFRA-04](specs/INFRA-04.md) | Pablo; revisora propuesta Shirley | Integrada: su código documental está contenido en c89b1b9 | La presencia en develop está comprobada; no se inventa evidencia de revisión humana/cierre |
| [FRONT-01](specs/FRONT-01.md) | Pablo; revisión humana por confirmar | T3a verificada desde develop; pendiente de revisión | Transporte JSON/errores; 17 contratos y lint frontend aprobados. Backend: lint y 657 pruebas aprobados; formato falla en 27 archivos previos. Cambio menor de 400 líneas. T3b–T3d se retomarán desde develop tras integrar sus dependencias. Avance completo anterior conservado; sección 27 de la spec |
| search, bookings, payments y tickets | Según propuesta inferior | Sin implementación en la base examinada | Confirmar ramas de los responsables antes de crear tareas |
| [PAGOS-01](specs/PAGOS-01.md) | Shirley | Código integrado en `origin/develop` en `f26415d`; revisión/cierre humano no se infieren | El merge commit `f26415d` incorpora PAGOS-01 (`518c46b` como segundo padre). La evidencia de pruebas registrada corresponde a la rama de origen, no a una repetición posterior al merge. `bookings` sigue simulado conforme al alcance T4. |
| [PAGOS-02](specs/PAGOS-02.md) | Shirley; Pablo (@PabloToapanta) revisor aceptado; Leslie complementaria propuesta | En desarrollo; adaptador no conectado y pruebas verificadas, descripción detallada de PR sin publicación | Rama `feature/PAGOS-02-aprobar-comprobante`, base común `518c46b`; rutas con Reservas simulado. Nuevo adaptador de contrato con 74 casos; suite global 668 unitarias + 134 integraciones aprobadas (802). Lint/formato propio aprobados; formato global fallido en 48 ajenos. Conexión real, versiones/importe observado y combinación con develop pendientes. [Evidencia](evidence/PAGOS-02/2026-11-02-adaptador-lector.md). |
| [Lectura `findForPayment`](pagos-reservas-find-for-payment.md), anexo de PAGOS-01/02 y BOOK-07-L05 | Pablo seleccionó por delegación reportada; Leslie proveedor, Shirley consumidor | Diseño seleccionado en PR #46 con conformidad documental; adaptador consumidor acotado probado | proofWindowStartedAt explícito, contexto/códigos seleccionados y recepción persistida requerida. No repetir aceptación genérica del diseño. Adaptador nuevo no conectado; Leslie debe publicar persistencia/proveedor y sus pruebas. El lector anterior de las rutas aún no cambió; F11 y la matriz completa de proveedor siguen pendientes. |
| PAGOS-03, planificación S-03 | Shirley; Pablo aceptó revisar el incremento | Borrador existente en la referencia local `origin/feature/PAGOS-01-subir-comprobante`, commit `72887bd`; no está en la rama actual PAGOS-02 ni consta aprobación técnica | Rechazo justificado y liberación coordinada; falta concretar `releaseBooking` y recuperación entre módulos. No se crea una segunda spec con el mismo ID. |
| PAGOS-CORR-01, planificación S-03 | Shirley; Pablo aceptó revisar el incremento | Borrador local conciliado el 2 de noviembre, separado de la publicación PAGOS-02; no aprobado para implementar | PR #35 ya confirma 3/15 minutos; eventos técnicos, rondas, versionado/correo y efecto del vencimiento siguen pendientes. Leslie no aprobó cerrar edición/mantener revisión al vencer. Depende de S-02, L-05, PAGOS-01/02 y P-03. |
| PAGOS-CAJA-01, relacionada con S-04 | Shirley; Pablo aceptó revisar el incremento | Borrador local conciliado el 2 de noviembre, separado de la publicación PAGOS-02; no aprobado para implementar | PR #35 confirma efectivo mediante reserva y sin archivo de depósito. Plazo de caja, titularidad, abandono/cancelación, resultados e idempotencia siguen pendientes. Depende de P-02, L-03 y L-05. |
| CI | Pablo | Sin workflow versionado en la base | Proponer una spec propia; no afirmar protecciones remotas sin consultarlas |

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
