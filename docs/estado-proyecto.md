# Estado compartido del proyecto

## Alcance y frescura de esta fotografía

- **Fecha de comprobación:** 29 de octubre de 2026, America/Guayaquil.
- **Base integrada examinada:** `origin/develop` en `f26415d`, actualizada mediante `git fetch origin`; incluye T2 (92d91d3), T3a (e715c86), bienvenida WEB-01 y carga de comprobantes.
- **Cambio local actual:** FRONT-01 T3b en `feature/FRONT-01-T3b-cache-csrf`, desde f26415d. Caché CSRF y 13 contratos nuevos; pendiente de revisión humana e integración.
- **Alcance de esta actualización:** FRONT-01 y próximos pasos de Pablo contrastados hoy con Git y PR #21. Pablo aclaró que PR #20 fue un error y se cerró por ese motivo; no se recomienda reabrirla. Las demás filas conservan sus fuentes y pueden requerir conciliación. La evidencia previa de PAGOS-01 no equivale a una ejecución nueva de esa tarea.
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
| [FRONT-01](specs/FRONT-01.md) | Pablo; revisión humana de T3b pendiente | T2 y T3a integradas; T3b guardada en el commit que contiene esta constancia; pendiente de publicación/revisión | Base f26415d; T3a PR #21/e715c86. T3b: lint frontend y 30 contratos aprobados (13 nuevos); backend lint y 680 pruebas aprobados, formato global fallido en 24 archivos existentes. T3c/T3d pendientes; sección 28 de la spec. |
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
- No se ha enviado ningún mensaje a otros integrantes ni se presupone su aprobación. Las filas históricas siguientes conservan su fecha y alcance; el registro de buses ya tiene borrador de spec, pero no está aprobado para implementar.

Orden recomendado para discutir con el equipo. Cada fila es **Propuesta sin spec**, salvo la referencia a una tarea existente. Confirmar asignación y disponibilidad; las prioridades no son fechas comprometidas. Las pantallas se separan cuando su contrato está listo.

| Integrante | Orden y tarea pequeña propuesta | Dependencia / primer paso |
|---|---|---|
| Pablo | 1. Registrar la revisión/cierre de INFRA-04 cuando exista evidencia humana | Su contenido ya está en develop; no repetir implementación ni autoaprobar |
| Pablo | 2. Preparar publicación/revisión de AUTH-BOOTSTRAP-01 | Corrección local verificada en 9b65e9f; comprobar integración con develop antes de cerrarla |
| Pablo | 3. FRONT-01: preparar publicación y revisión humana de T3b | Caché/invalidación CSRF implementadas en feature/FRONT-01-T3b-cache-csrf; guardadas por autorización de Pablo el 30 de octubre, en el commit que contiene esta constancia. Sin publicación. Tras integrar T3b, continuar T3c y luego T3d desde develop. PR #20 descartada por aclaración humana; no es un bloqueo de T3b. |
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
