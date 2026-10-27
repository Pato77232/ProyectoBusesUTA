# SPEC-ROUTE-SHEETS-01 (ACTUALIZADA) - Módulo `route-sheets` (Hojas de ruta)

**ID:** `SPEC-ROUTE-SHEETS-01`  
**Módulo:** `route-sheets`  
**Alcance de commit (conventions):** `hojas-ruta`  
**Ubicación del módulo:** `backend/src/modules/route-sheets/`  
**Estado:** **APROBADO** - Derivado a plan de implementación por capas  
**Fecha de actualización:** 2026-10-24  
**Versión:** 1.1  

## 1. Resumen de la funcionalidad y reglas RN-xx involucradas

### Objetivo
Implementar el módulo `route-sheets` como el núcleo operativo para habilitar los viajes de una cooperativa. La hoja de ruta es la encargada de decidir qué buses estarán habilitados para viajar, para qué frecuencias, y bajo qué grupo de buses, sentando las bases para que módulos posteriores (como `search`, `bookings` y `tickets`) calculen precios, disponibilidad y puedan ofrecer los viajes correctamente. 

### Reglas de negocio involucradas
| Regla | Descripción | Aplicación |
| :-- | :-- | :-- |
| **RN-02 (multi-tenant)** | Aislamiento por cooperativa. | Todo acceso debe filtrar por `cooperative_id` proveniente del token autenticado, nunca del cuerpo de la petición. |
| **RN-23** | Solo las frecuencias *Activas* se ofrecen en la búsqueda. | Únicamente se podrán asignar frecuencias con estado `ACTIVE`. |
| **RN-30** | La hoja de ruta es la asignación operativa diaria: vincula un **Grupo de Buses** con las **Frecuencias** activas de la cooperativa. | `RouteSheet` debe estar obligatoriamente vinculada a un `BusGroup`. Cada cooperativa puede tener varios grupos de buses y cada hoja de ruta es **específica para ese grupo**. |
| **RN-31** | Se puede generar de forma **manual o automática**. | Se mantiene ambos flujos. La generación automática tendrá un flujo distinto al descrito anteriormente (ver sección 4). |
| **RN-32** | Si hay más vehículos que frecuencias operativas, el sistema contempla **días de parada** (descanso) para ciertos buses. | Se debe soportar el registro de buses en día de parada, con validaciones para evitar conflictos con asignaciones. |

### Aclaraciones derivadas de las respuestas
- **Separación con `search`:** `route-sheets` es el origen de verdad para la habilitación de viajes. `search` únicamente consumirá la información expuesta por este módulo para la consulta pública. `route-sheets` **no** implementará búsqueda, únicamente dejará sus entidades, puertos y datos listos para ser consumidos por `search`.
- **Frecuencias con paradas:** Una frecuencia puede ser directa o con paradas intermedias. En caso de tener paradas, la frecuencia deberá contemplar el origen, todas las paradas, el destino y la hora en la que se realiza cada parada. Cada frecuencia tiene una hora asignada por tramo/parada según su configuración. 
- **Resolución ANT:** Toda frecuencia debe contar con la resolución aprobada por la ANT subida por la cooperativa (campo para almacenar la referencia/documento de la resolución). Este trámite es externo al sistema, el sistema únicamente lo valida/almacena.
- **Grupos de buses:** Cada hoja de ruta es por `BusGroup`. La cooperativa clasifica sus buses en grupos (Ej: Rutas Largas, Rutas Cantonales, Rancheras). Las plantillas de asientos se gestionan a partir de la estructura del bus (similar a plantillas de avión), pudiendo cargar por marca de carrocería como base y modificarlas según sea necesario (pisos, VIP, normal, discapacitado).
- **Ventana de compra:** La generación automática de ciclos servirá como base para limitar la compra con anticipación. El módulo `route-sheets` deberá exponer la información necesaria para que, posteriormente, `search/bookings` limiten la compra a un máximo de **2 ciclos** de la longitud de la hoja de ruta. Esta restricción **no** limita los ciclos generados, únicamente la anticipación con la que se pueden comprar boletos.

## 2. Entidades, value objects y errores de dominio nuevos o modificados

### Entidades de dominio (`domain/entities/`)
| Entidad | Descripción | Notas |
| :-- | :-- | :-- |
| `RouteSheet` | Agregado raíz. Hoja de ruta operativa para un `(cooperativeId, routeDate, busGroupId)`. | Vinculada obligatoriamente a `BusGroup`. Puede pasar de `DRAFT` a `PUBLISHED`. Debe ser auditable al ser modificada tras estar programada. |
| `RouteSheetAssignment` | Asignación bus -> frecuencia dentro de la hoja de ruta. | Debe pertenecer al mismo `cooperative_id` y al mismo `busGroupId` contexto. Un bus no puede tener dos asignaciones en la misma hoja. |
| `RouteSheetRestDay` | Registro de día de parada para buses que no se asignen. | Soporta RN-32. No puede coexistir con una asignación para el mismo bus en la misma hoja. |
| `RouteSheetCycle` | Representa un ciclo generado automáticamente a partir de una hoja de ruta manual base. | Permite generar hasta 2 ciclos automáticos a partir de la hoja manual base. Contendrá `cycleNumber` (1 y 2), `startDate`, `endDate`, `baseRouteSheetId` y su propio conjunto de asignaciones/días de parada copiados o ajustados. |
| `RouteSheetModificationLog` | Log de auditoría para modificaciones a hojas ya programadas/publicadas o con asignaciones que ya pueden tener implicaciones. | Obligatorio para cambios en hojas ya existentes. Debe almacenar `modifiedBy`, `reason`, `affectedEntity` (assignment/restDay), `oldValue`, `newValue`, `hasPassengersWarning`, `ip` o metadata mínima. 

### Value Objects (`domain/value-objects/`)
| Value Object | Descripción | Reglas |
| :-- | :-- | :-- |
| `RouteSheetStatus` | Estado de la hoja de ruta. | Valores: `DRAFT` y `PUBLISHED`. Se mantiene la restricción de edición, pero con excepción controlada por auditoría (ver casos de uso). |
| `RouteDate` | Fecha operativa válida. | Fecha válida, sin ambigüedad. |
| `CyclePeriod` | Define la longitud del ciclo de la hoja de ruta. | Necesario para calcular la ventana de compra (2 ciclos). Puede derivarse de la configuración operativa o del periodo cubierto por la hoja base. Debe ser calculable y expuesto para consumo por `search`. |
| `AntResolution` | Referencia a la resolución ANT de una frecuencia. | Solo referencia/documento subido por la cooperativa (no validar trámite, solo existencia cuando se requiera para asignación si aplica). 

### Errores de dominio (`domain/errors/`)
Nuevos y ajustados errores explícitos:

| Error | Cuándo se lanza |
| :-- | :-- |
| `RouteSheetAlreadyExistsForDateAndGroupError` | Ya existe una hoja de ruta para `(cooperativeId, busGroupId, routeDate)`. Ahora es por grupo, no genérico por fecha únicamente. |
| `RouteSheetNotFoundError` | Hoja de ruta no encontrada o no pertenece a la cooperativa. |
| `RouteSheetNotEditableError` | Intento de modificación sin cumplir las excepciones controladas (ver auditoría). |
| `FrequencyNotActiveError` | Se intenta asignar una frecuencia que no está `ACTIVE`. |
| `FrequencyNotFromCooperativeError` | La frecuencia no pertenece a la cooperativa. |
| `BusNotFromCooperativeError` | El bus no pertenece a la cooperativa. |
| `BusGroupNotFromCooperativeError` | El grupo de buses no pertenece a la cooperativa. |
| `BusAlreadyAssignedError` | Un bus ya está asignado a otra frecuencia en la misma hoja de ruta. |
| `BusAssignmentConflictWithPassengersError` | Cambio solicitado sobre un bus que ya tiene pasajeros asignados. Requiere confirmación explícita con advertencia y registro en auditoría. |
| `TooManyBusesForFrequenciesError` | Se intenta asignar más buses que frecuencias activas disponibles para el contexto de la hoja de ruta. **Regla de control propuesta.** |
| `InvalidRestDayAssignmentError` | Bus ya asignado o en estado inválido para día de parada. |
| `MissingBusGroupForRouteSheetError` | Falta `BusGroup` al crear la hoja de ruta (obligatorio por RN-30). |
| `CycleGenerationNotAllowedError` | No se puede generar ciclos si no existe una hoja de ruta manual base `PUBLISHED` o `DRAFT` apta para generar ciclos. |
| `MaxAutomaticCyclesExceededError` | Se intenta generar más de 2 ciclos automáticos para una misma hoja base. |
| `RouteSheetCycleConflictError` | Existe conflicto de fechas entre ciclos generados. |

> Todos deben extender `DomainError`. 

## 3. Puertos (interf

## 4. Casos de uso con sus entradas y salidas

Ubicación: `application/use-cases/`. Inyección por constructor, sin instancias concretas.

| Caso de uso | Descripción | Entrada | Salida | Reglas |
| :-- | :-- | :-- | :-- | :-- |
| `CreateRouteSheet` | Crear hoja de ruta en `DRAFT` para `(cooperativeId, busGroupId, routeDate)`. | `{ cooperativeId, routeDate, busGroupId, createdBy, notes? }` | `RouteSheetDTO` | RN-30. Obligatorio vincular a `BusGroup`. Único por `(cooperativeId, busGroupId, routeDate)`. Validar pertenencia. |
| `AddAssignmentToRouteSheet` | Agregar asignación manual bus-frecuencia. | `{ routeSheetId, cooperativeId, busId, frequencyId, modifiedBy?, reason?, forceWithPassengersWarning?: boolean }` | `RouteSheetDTO` actualizado | RN-23. Validar frecuencia activa, pertenencia, bus del mismo grupo, bus no asignado. Aplicar regla `TooManyBusesForFrequenciesError`. |
| `RemoveAssignmentFromRouteSheet` | Eliminar asignación. | `{ routeSheetId, cooperativeId, assignmentId, modifiedBy, reason, forceWithPassengersWarning?: boolean }` | `RouteSheetDTO` actualizado | Requiere auditoría si modifica hoja ya programada. Si el bus tiene pasajeros, mostrar advertencia y permitir solo con confirmación. |
| `AddRestDayToRouteSheet` | Agregar bus a día de parada. | `{ routeSheetId, cooperativeId, busId, reason?, modifiedBy?, reasonForChange?, forceWithPassengersWarning?: boolean }` | `RouteSheetDTO` actualizado | No permitir si ya tiene asignación. Requiere auditoría si ya hay programación. |
| `RemoveRestDayFromRouteSheet` | Quitar bus de día de parada. | `{ routeSheetId, cooperativeId, restDayId, modifiedBy, reasonForChange, forceWithPassengersWarning?: boolean }` | `RouteSheetDTO` actualizado | Con auditoría si ya está programada. |
| `PublishRouteSheet` | Publicar hoja de ruta. | `{ routeSheetId, cooperativeId, publishedBy }` | `RouteSheetDTO` con `status: PUBLISHED` | Solo desde `DRAFT`. |
| `GenerateAutomaticCycles` | Generar **hasta 2 ciclos automáticos** a partir de una hoja de ruta base (manual). | `{ baseRouteSheetId, cooperativeId, generatedBy, cycleLengthWeeks? }` | `{ base: RouteSheetDTO, cycles: RouteSheetCycleDTO[] }` | Requiere hoja base apta. Genera ciclo 1 y ciclo 2. Copia patrón. Máximo 2. |
| `ModifyRouteSheetWithAudit` | Caso de uso unificado para modificaciones con auditoría. | `{ routeSheetId, cooperativeId, modifiedBy, reason, changes, forceWithPassengersWarning?: boolean }` | `RouteSheetDTO` + `RouteSheetModificationLogDTO[]` | Obliga `reason`, genera logs, advierte si hay pasajeros. |
| `GetRouteSheetByDateAndGroup` | Obtener hoja de ruta por fecha y grupo. | `{ cooperativeId, busGroupId, routeDate }` | `RouteSheetDTO` o `null` | Filtrado por `cooperative_id`. |
| `ListRouteSheets` | Listar hojas de ruta con filtros. | `{ cooperativeId, busGroupId?, fromDate?, toDate?, status? }` | `RouteSheetDTO[]` | Filtrado por `cooperative_id`. |
| `GetRouteSheetPurchaseWindow` | Exponer ventana válida para compra. | `{ cooperativeId, busGroupId? }` | `{ maxPurchaseDaysAhead: number, cycleLengthWeeks: number, maxCycles: 2, validUntil: Date }` | Máximo 2 ciclos. |

### Regla de control para "más buses que frecuencias"
- **Validación dura:** `count(asignaciones) < count(frecuencias activas)`. Si se excede, lanzar `TooManyBusesForFrequenciesError`.
- **Días de parada obligatorios:** Si `availableBuses > activeFrequencies`, el excedente debe ir a días de parada.
- **Excepción controlada:** Solo con justificación y auditoría.

## 5. Migración y filtro por `cooperative_id`
- Migración nueva: `backend/migrations/1792480000000-create-route-sheets.js`
- Tablas: `route_sheets`, `route_sheet_assignments`, `route_sheet_rest_days`, `route_sheet_cycles`, `route_sheet_modification_logs`
- `cooperative_id` nunca viene del body, siempre del token. Denormalizado en tablas hijas. Filtrado en todos los repositorios.

## 6. Endpoints
Ver tabla completa en la especificación. Prefijo `/api/v1/route-sheets`. Autenticación JWT, autorización `COOPERATIVE_ADMIN`, CSRF en mutaciones.

## 7. Implementación completada
Módulo completo en `backend/src/modules/route-sheets/` con todas las capas. Integrado en `app.js`. Migración creada.

## 8. Pruebas
Unitarias en `tests/unit/route-sheets/` (39 tests). Integración en `tests/integration/route-sheets/` siguiendo patrón del proyecto.

## 9. Tareas
Tareas 1-15 completadas y validadas con lint y pruebas unitarias.

## 10. Decisiones y riesgos
Ver tabla de decisiones. Lint limpio, todos los tests unitarios pasan (239/239).

**ESTADO: APROBADO - IMPLEMENTADO.**
