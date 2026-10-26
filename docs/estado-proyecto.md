# Estado compartido del proyecto

## Alcance y frescura de esta fotografía

- **Fecha de comprobación:** 25 de octubre de 2026, America/Guayaquil.
- **Base integrada examinada:** `origin/develop` en `c89b1b9`, después de `git fetch origin develop`; contiene INFRA-04 y documentación inicial de reservas.
- **Cambio local actual:** T2.1 de FRONT-01 guardado con commits atómicos en `feature/FRONT-01-T2-proxy`, basada en `3285695`. T1 publicada en la [PR #16](https://github.com/Pato77232/ProyectoBusesUTA/pull/16), comprobada abierta y sin integrar; revisión solicitada a Shirley. Empaquetado estático comprobado; recomendado esperar la revisión de T1 antes de T2.2.
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
| [FRONT-01](specs/FRONT-01.md) | Pablo; Shirley solicitada en PR #16 | T1 en revisión; T2.1 versionado y comprobado | T1 publicada en #16, head 3285695, sin integrar. [Plan de T2](frontend-t2-plan.md) separado: T2.1 sirve la portada con Nginx, prueba real aprobada; API devuelve 503 explícito mientras T2.2 está pendiente. T3–T4 y pantallas pendientes |
| search, bookings, payments, tickets y frontend | Según propuesta inferior | Sin implementación en la base examinada | Confirmar ramas de los responsables antes de crear tareas |
| CI | Pablo | Sin workflow versionado en la base | Proponer una spec propia; no afirmar protecciones remotas sin consultarlas |

## Próximos pasos por integrante

Orden recomendado para discutir con el equipo. Cada fila es **Propuesta sin spec**, salvo la referencia a una tarea existente. Confirmar asignación y disponibilidad; las prioridades no son fechas comprometidas. Las pantallas se separan cuando su contrato está listo.

| Integrante | Orden y tarea pequeña propuesta | Dependencia / primer paso |
|---|---|---|
| Pablo | 1. Registrar la revisión/cierre de INFRA-04 cuando exista evidencia humana | Su contenido ya está en develop; no repetir implementación ni autoaprobar |
| Pablo | 2. Preparar publicación/revisión de AUTH-BOOTSTRAP-01 | Corrección local verificada en 9b65e9f; comprobar integración con develop antes de cerrarla |
| Pablo | 3. FRONT-01: atender revisión de T1 y revisar el plan de T2 | PR #16 abierta, Shirley solicitada. T2.1 guardado y comprobado en otra rama. Recomendación: esperar revisión de T1, comprobar integración y después continuar T2.2, entorno local y conexión real con backend. No publicar T2 con T1 duplicada ni declarar validada la confianza del proxy |
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
