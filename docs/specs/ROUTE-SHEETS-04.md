# ROUTE-SHEETS-04: Contrato de programación multifrecuencia

- **Referencia de planificación:** D-01; no es un ticket externo.
- **Módulo:** route-sheets; frecuencias y Fleet como proveedores públicos.
- **Responsable:** David, según distribución y actividad elegida en el chat.
- **Estado:** Aprobada para planificación y definición técnica por solicitud humana; implementación por secciones pendiente de autorización. Revisión de código no realizada.
- **Fecha:** 1 de noviembre de 2026, America/Guayaquil.
- **Rama / base:** feature/programacion-multifrecuencia-spec, b60201e. Árbol inicialmente limpio. Ramas locales y referencias remotas almacenadas examinadas; no se refrescó remoto en esta sesión ni se certifica trabajo privado de otros integrantes.
- **Participantes del acuerdo:** David/solicitante, Edwin y Leslie según reporte humano del solicitante. El usuario informó que revisaron preguntas/propuestas juntos, las aceptaron y delegó concretar el contrato. No hubo comunicación directa del asistente con Edwin/Leslie ni se inventan actas o aprobaciones de PR.
- **Revisor humano:** Leslie propuesta según distribución; aceptación de revisar este código pendiente. Edwin participa en contrato de flota, sin asignarle implementación en esta spec.
- **ID:** ROUTE-SHEETS-04 libre en specs y nombres de ramas examinados; ROUTE-SHEETS-03 se conserva para vistas según ROUTE-SHEETS-02.

## 1. Objetivo

Definir un patrón operativo comprobable que permita varios servicios por bus, con fechas, continuidad geográfica y tiempo de preparación, y precisar ciclo/renovación/horizonte para futuros consumidores de viajes. La primera implementación es validación pura de dominio; no implica reescribir el módulo completo.

## 2. Fuentes, decisión compartida y alcance de la aceptación

RN-02, RN-20–23 y RN-30–32; [acuerdos](../acuerdos-primera-entrega.md), [arquitectura](../architecture.md), [calidad](../calidad.md), ROUTE-SHEETS-01/02 y convenciones. El solicitante aceptó propuestas revisadas con Edwin y Leslie y autorizó completar detalles técnicos; esta spec los registra como concreción de esa delegación. La aceptación del enfoque no equivale a validación física de tiempos, cumplimiento de jornadas de conductores ni revisión del código futuro.

**Decisión:** patrón manual factible, repetición explícita sin optimización automática, intervalos fechados y ubicaciones compatibles; dos ciclos totales confirmables, incluyendo base. El administrador elige asignaciones y duración, el sistema valida. No se infiere duración multiplicando cantidades ni se presupone equidad automática de kilómetros/descansos.

**Reemplaza:** prohibición absoluta de asignar el mismo bus varias veces por hoja; comparación global de buses y frecuencias como prueba de factibilidad; ciclos solo en semanas o valor oculto de dos semanas; base más dos ciclos adicionales. La migración desde contratos antiguos corresponde a tareas posteriores, sin borrar evidencia ni editar migraciones existentes.

## 3. Reglas del contrato

### 3.1. Servicio y tiempos

- Un servicio comercial es la realización fechada de una frecuencia aprobada para un bus; varios servicios compatibles pueden usar el mismo bus. Una parada dentro de una frecuencia no crea otra frecuencia ni otro viaje.
- Salida y llegada son instantes completos; representación de intercambio ISO 8601 con desplazamiento explícito. Planificación/visualización en zona America/Guayaquil para este alcance continental. No deducir fecha por comparación de horas ni depender de la zona horaria del equipo.
- La salida debe coincidir con la hora autorizada de la frecuencia en su fecha local. Llegada estrictamente posterior a salida. Cada parada mantiene orden temporal y fecha explícita; su embarque no puede quedar fuera del intervalo del servicio.
- Las horas de llegada/embarques y duración de traslados son estimaciones operativas introducidas expresamente por COOPERATIVE_ADMIN para el patrón; no se inventan desde distancias, APIs externas o valores de prueba. No cambia origen/destino/hora inmutable de la frecuencia. Un patrón incompleto no puede publicarse.
- `preparationMinutes`: entero seguro no negativo, obligatorio, sin valor por defecto oculto; lo define el administrador para cada actividad. Se exige el valor aunque sea cero, como decisión explícita. No equivale al descanso del conductor ni habilita incumplir un bloqueo de descanso/mantenimiento.
- Intervalo ocupado: `[departureAt, arrivalAt + preparationMinutes)`. Para dos actividades ordenadas del mismo bus: `next.departureAt >= previous.readyAt`. Igualdad permitida; un minuto menos es conflicto. Durante la preparación se conserva la ubicación de llegada.
- Todo conflicto se evalúa contra otras hojas/ciclos y actividades del mismo bus, no solo dentro de la hoja editada. El validador puro recibe todas las actividades pertinentes; el futuro caso de uso obtiene esa información mediante su puerto, no el body como única autoridad.

### 3.2. Ubicaciones, traslados y disponibilidad

- Usar un catálogo de lugares consistente. Hasta existir un catálogo con ID, la clave de comparación técnica es el nombre con espacios exteriores eliminados y normalización Unicode NFC; no eliminar tildes ni fusionar lugares por similitud. La hora/recorrido comercial procede de la frecuencia; no confiar en origen/destino enviados por cliente. El futuro contrato de catálogo podrá reemplazar esta clave mediante spec propia.
- Registrar ubicación inicial conocida por bus y fecha/hora desde la que está disponible. La primera actividad debe ser alcanzable desde esa ubicación; no se supone teletransporte ni ubicación inicial arbitraria.
- Entre actividades, el destino anterior debe coincidir con el origen siguiente. Si no, se exige una actividad `TRANSFER` fechada que conecte ambos puntos, con llegada y preparación. Traslado no genera viaje vendible ni frecuencia ANT ficticia.
- Actividades `SERVICE`/`TRANSFER` pertenecen a un bus y a su cooperativa. Todo servicio requiere frecuencia activa de la misma cooperativa y bus del grupo de la hoja. Identidad del tenant procede de autenticación en futuras operaciones HTTP.
- Bloqueos `REST` y `MAINTENANCE` tienen inicio/fin explícitos, no se solapan con ocupación ni preparación. Disponibilidad `STANDBY` permite seleccionar un sustituto solo con validación nueva; no asigna dos servicios a la vez ni implica que un mantenimiento pueda interrumpirse.
- Sustituir un bus no es una excepción al validador temporal. Mapear asientos, reubicar pasajeros y autorizar cambios publicados corresponden a D-05 y contratos con Fleet/Bookings; no se implementan aquí.

### 3.3. Cobertura y patrón

- El administrador declara servicios requeridos de la hoja por frecuencia/fecha. Debe existir exactamente una asignación por servicio requerido para publicar; no duplicar la misma salida entre buses. Listar solo asignaciones no demuestra cobertura: comparar con la lista de servicios requeridos.
- No exigir `frecuencias <= buses`: un bus puede cubrir tres servicios sucesivos y no puede cubrir dos simultáneos. Tampoco deducir días de parada de la diferencia de esos conteos.
- Patrón manual: lista explícita de días/actividades por bus, bloqueos y ubicación inicial. No algoritmo de rotación por índice, kilómetros o reparto automático de descansos. Si se desea esa optimización, definir otra spec.
- Duración `cycleLengthDays`: entero seguro positivo y explícito. Se elige para cubrir el patrón completo repetible y se valida; no se calcula por número de buses/frecuencias ni se redondea a semanas.
- Traslados y preparación deben terminar dentro del período del patrón. Un servicio nocturno no puede quedar cortado por el límite de ciclo: ampliar o reorganizar el patrón antes de confirmar. Las obligaciones que llegan de otro período se consultan para verificar el inicio.
- Para repetir, desplazar todas las fechas tantos días como dure el ciclo y validar, por bus, continuidad de ubicación y tiempo entre la última actividad del patrón y la primera repetida. Si no cierra, completar traslado/bloqueo o cambiar patrón. Descanso no se inventa para llenar huecos.

### 3.4. Dos ciclos, publicación y horizonte

- Dos ciclos **totales**, no base más dos: ciclo 1 base y ciclo 2 repetición del patrón. Ambos tienen duración L días. Generarlos en borrador no habilita compras.
- Sea S el inicio local del ciclo 1 a las 00:00. Intervalos semiabiertos: C1 = `[S, S+L días)`, C2 = `[S+L, S+2L días)`. Para L=20, S=2026-11-01, C1 termina exclusivamente 2026-11-21 00:00 y C2 termina exclusivamente 2026-12-11 00:00; último día de inicio de servicio elegible 10 de diciembre.
- `confirmedThroughExclusive`: final del último ciclo consecutivo publicado/confirmado. Si solo C1 está publicado, el límite es S+L; C2 borrador no amplía ventas. Si ambos lo están, el límite es S+2L. La referencia no es «hoy + 40» en cada búsqueda.
- Generar el siguiente ciclo requiere acción explícita; confirmar/publicar requiere administrador autenticado y validación completa de cobertura/compatibilidad. No renovación silenciosa por reloj.
- Renovación móvil: tras acabar C1, C2 pasa a ser el primero vigente; puede prepararse/confirmarse un nuevo ciclo siguiente. No más de dos períodos no terminados confirmados por grupo; conservar historial y no renumerar IDs/ventas antiguas. No crear una serie paralela para eludir el límite.
- Venta elegible solo para servicio de ciclo confirmado, frecuencia activa y configuración válida. Para cada embarque: `now < boardingAt` y `boardingAt < confirmedThroughExclusive`; al instante de embarque cierra reserva de ese punto (cero minutos adicionales de anticipación para esta fase). El usuario ve fecha y hora de su parada. Esta política no implementa cobro/validación a bordo.
- RN-23 protege compromisos: no desactivar una frecuencia con servicios futuros publicados o pasajeros RESERVED/SOLD afectados. Dejar de renovar permite finalizar sus obligaciones y desactivar después; no cancelar compras para satisfacer un cambio de estado.

## 4. Datos y responsabilidades de validación

Nombres conceptuales para contratos internos, no columnas/endpoints ya creados:

| Dato | Contenido / fuente |
|---|---|
| Contexto | cooperativeId autenticado, busGroupId de hoja, cycleStartDate, cycleLengthDays |
| Actividad | id estable, busId, kind SERVICE/TRANSFER, departureAt, arrivalAt, preparationMinutes, originKey, destinationKey |
| Servicio | frequencyId y clave de salida requerida; recorrido y hora autorizada obtenidos de FrequencyQueries |
| Bus | id/cooperativeId/busGroupId obtenidos por Fleet; disponibilidad inicial y bloqueos declarados por operación y comprobados en servidor |
| Bloqueo | busId, kind REST/MAINTENANCE, startAt/endAt y motivo |
| Estado de ciclo | identidad estable, intervalo, DRAFT/PUBLISHED, confirmación actor/fecha; historial conservado |

Dominio valida intervalos, continuidad, repetición y cobertura sobre snapshots ya confiables. Application obtiene información por puertos de su módulo/APIs públicas y verifica tenant, versión y concurrencia. Infrastructure persiste transaccionalmente, futura HTTP traduce errores y autentica. No duplicar la autoridad de horarios/catálogos en el navegador.

## 5. Ejemplos de aceptación (horas ficticias)

Fecha común: 2026-11-02; preparación de 15 minutos solo para estos ejemplos, no un valor por defecto.

| Caso | Datos | Resultado esperado |
|---|---|---|
| Encadenamiento | Ambato–Latacunga 07:00–08:00; Latacunga–Quito 08:15–10:00; Quito–Ambato 10:15–13:00 | Válido con bus inicialmente disponible en Ambato y sin otros conflictos |
| Margen insuficiente | Primer servicio llega 08:00; siguiente sale 08:14 | Conflicto, aunque no se solapen los recorridos |
| Solapamiento | Primer servicio llega 08:00; siguiente sale 07:50 | Conflicto temporal |
| Ciudad incompatible | Llega Quito 10:00; siguiente sale Ambato 12:00 sin traslado | Inválido, aunque sobre tiempo |
| Traslado explícito | Llega Quito 10:00/prepara hasta 10:15; traslado Quito–Ambato 10:15–12:00/prepara hasta 12:15; siguiente sale Ambato 12:15 | Temporalmente válido con datos operativos expresos |
| Nocturno | Quito–Ambato 02 nov. 23:00 → 03 nov. 02:00; siguiente Ambato 03 nov. 02:15 | Válido; sale 03 nov. 02:14: inválido |
| Repetición abierta | Patrón termina Quito, siguiente repetición empieza Ambato sin traslado | No repetible |
| Cobertura | Tres servicios sucesivos, un bus compatible | Puede ser válido; dos servicios simultáneos con ese bus: inválido |
| Bloqueo | Mantenimiento 08:00–11:00 y servicio 09:00–10:00 | Inválido; respaldo no sustituye esa prohibición |
| Ventana | C2 borrador; salida ubicada en C2 | No comercializable aunque esté a menos de 2L días |

## 6. Diferencias comprobadas con el código actual

- RouteSheetAssignment no tiene tiempos/ubicaciones; AddAssignment valida bus no asignado antes y compara conteos. La base tiene índice único `(route_sheet_id, bus_id)` y otro de frecuencia por hoja. Requieren diseño/migración nuevos en D-03; no borrar/editar migración histórica.
- CyclePeriod y RouteSheet usan semanas; GenerateAutomaticCycles tiene predeterminado de dos semanas y genera registros DRAFT. No materializa por sí solo todo el calendario de servicios; contar ciclos no demuestra viajes válidos.
- GetRouteSheetPurchaseWindow existe, pero fija `cycleLengthWeeks = 2`, calcula 28 días desde el reloj actual y no obtiene el límite de los ciclos confirmados. Esa implementación no satisface esta spec. Se conserva hasta adaptar sus consumidores en el incremento autorizado correspondiente; tener router de hojas no implementa el nuevo contrato.
- Hoja actual identificada por fecha/grupo no equivale a patrón multidiario: la representación persistida se decidirá en spec D-03/D-05 sin crear aquí tablas implícitas ni cambiar todo el módulo.

## 7. Alcance ejecutable: tres secciones, un commit por sección

Por aclaración humana posterior, esta tarea tiene tres secciones (0, 1 y 2) y cada sección corresponde a un único commit lógico. Cada sección funcional reúne código, pruebas y evidencia relacionada; no se separan en commits adicionales. Implementar una sección y ejecutar su commit son autorizaciones distintas: los commits solo se ejecutan si el humano los pide. La sección 0 está preparada documentalmente; las secciones 1 y 2 esperan petición expresa.

### Sección 0 — Contrato y acuerdos (documentación actual)

**Estado:** completada en archivos locales, sin commit ni integración.

**Commit único sugerido:** `docs(hojas-ruta): define programación multifrecuencia`.

Incluye esta spec, reglas funcionales, registro del acuerdo, dependencias, plan de validación, enlace desde spec anterior y evidencia en estado-proyecto.md. Todos forman el mismo cambio documental.

### Sección 1 — Validar agenda de un bus (primera implementación autorizable)

**Resultado:** validador puro de actividades fechadas, preparación, disponibilidad inicial, bloqueos y continuidad. Sin BD, Express ni nuevos endpoints; todavía no se relaja la restricción actual de persistencia.

**Commit único sugerido:** `feat(hojas-ruta): valida la agenda multifrecuencia del bus`.

Incluye intervalos, preparación, orden cronológico, solapamientos, ubicación inicial, traslados y bloqueos REST/MAINTENANCE; sus pruebas de límites/nocturnos/secuencias y la actualización de spec/estado con resultados reales.

**Archivos previstos:** nuevos componentes de domain de route-sheets y tests/unit/route-sheets; nombres precisos al implementar según convenciones. Errores de dominio explícitos, funciones cortas, sin dependencias nuevas por defecto.

### Sección 2 — Validar patrón y ventana de dos ciclos

**Resultado:** funciones puras que verifican cobertura, repetibilidad y límites comerciales a partir de datos explícitos; no generación/persistencia productiva ni catálogo de viajes.

**Commit único sugerido:** `feat(hojas-ruta): valida el patrón y la ventana de dos ciclos`.

Incluye cobertura de requeridos frente a asignados, ciclo en días, repetibilidad, límites exclusivos de ciclos confirmados, cierre por embarque y renovación; sus pruebas con reloj explícito y la actualización de spec/estado con resultados reales.

**Depende de sección 1**. No reemplazar consumidores actuales ni eliminar CyclePeriod sin plan de compatibilidad. Las pruebas históricas se conservan; si contradicen el nuevo contrato, reportar la contradicción y preparar adaptación autorizada sin debilitarlas para ocultar errores.

### Continuación fuera de esta implementación

- D-03: spec de un endpoint/caso de uso de asignación múltiple con migración nueva, consulta de conflictos entre hojas y concurrencia real. Antes de la sección de persistencia se debe decidir cómo mapear hoja diaria a patrón/ciclo.
- D-04: spec de viaje comercializable y API de lectura para Leslie/búsqueda; depende además de inventario real y tarifas.
- D-05: generación/confirmación/renovación persistidas y sustitución, cada una por separado. La consulta de ocupación es API pública de Bookings; ausente/fallida bloquea cambios sensibles.
- Las tareas posteriores definirán sus propias secciones y commits al preparar sus specs. Los tres commits de esta tarea corresponden exclusivamente a sus secciones 0, 1 y 2; no autorizan esas continuaciones.

## 8. Criterios y pruebas

- [ ] Intervalos/fechas inválidos, falta de offset y preparación omitida se rechazan; orden de entrada no altera resultado y no se mutan argumentos.
- [ ] Igualdad con readyAt permite continuar; un minuto antes rechaza; servicios nocturnos conservan día real.
- [ ] Continuidad inicial/intermedia/final, traslados y bloqueos satisfacen ejemplos de §5.
- [ ] Cobertura exige cada salida requerida una vez; más servicios que buses puede ser válido.
- [ ] L entero en días; patrón no se corta ni se repite desde otra ciudad sin traslado.
- [ ] Base incluida en dos ciclos; borrador no vende; inicio inclusivo y fin exclusivo; reloj explícito, cierre exacto en embarque; renovación no altera IDs antiguos ni excede límite.
- [ ] Si se integra producción posteriormente, comprobar multi-tenant, concurrencia de asignaciones y conflictos entre hojas en PostgreSQL aislado.
- [ ] Por sección funcional ejecutar lint, format:check y npm test desde backend con evidencia real; integración según testing-database.md. Arranque real si cambia composición.
- [ ] Revisión humana de cada incremento y evidencia de integración antes de cerrar.

## 9. SOLID, usabilidad y defectos

Dominio independiente y determinista, reloj/datos explícitos y errores específicos; application separado por caso de uso y puertos pequeños. No refactorizar otros módulos. Sin frontend en secciones 0–2: no declarar usabilidad visual probada; contratos futuros deben identificar conflicto y actividad afectada sin exponer tenant ajeno. Defectos inducidos: no aplica, respetar errores-inducidos.md.

## 10. Evidencia y siguiente paso

Solo documentación en esta sesión. `git diff --check` aprobado y 48 referencias locales comprobadas sin destinos inexistentes (sin validar externos/anclas); cuatro documentos existentes y esta spec nueva. No tests de producto ni cambios de algoritmo; no commits/publicación. Primera petición para continuar: **«Implementa la sección 1 de ROUTE-SHEETS-04, sin commits»**. Antes de la sección 2 presentar resultados de la 1. La delegación actual completa el contrato D-01 y permite solicitar esas secciones; no hay preguntas bloqueantes para el validador puro. Otros acuerdos (tarifas, accesibilidad y sustitución de pasajeros) permanecen en sus propias tareas.
