# BOOK-07: diseño transaccional y matriz de pruebas de confirmación

Fecha: 4 de noviembre de 2026, America/Guayaquil. Rama feature/BOOK-07-confirmacion-venta, base ae88e0c. Documento de diseño solicitado por Leslie mientras responde Shirley. No es una API disponible ni una spec externa nueva; complementa BOOK-07 T2/T3. Asistencia de Codex en inspección y preparación.

## 1. Confirmado, reportado y propuesto

Confirmado en el contrato histórico: confirmSale({ bookingId, cooperativeId, paymentProofId }), venta idempotente, recepción aceptada a tiempo protege asientos después del plazo inicial, autoridad del total en Bookings y contraste de transferencia en Payments, intención persistida antes de venta y aprobación final después.

Respuesta humana de Shirley compartida por Leslie: acepta adaptador a true solo tras venta persistida; BookingSaleRejectedError para rechazo definitivo; BookingSaleUncertainError para timeout/no confirmación. false sigue siendo incierto. Propone consulta pública de intención con tres identificadores y actor/fecha. Reporta bloqueo de reemplazos después de intención, también incierta, y ausencia de versión/huella. No equivale a verificar cambios locales de Shirley.

Propuesta enviada para conciliación y posteriormente aceptada según el mensaje compartido de Shirley (§9): proofVersion entero desde 1 para nuevos comprobantes, incremento con reemplazo exitoso, versión fijada atómicamente en intención y conservada en venta. El versionado no entra como cuarto identificador del navegador en confirmSale. Forma/nombre final del puerto, DTO/errores de Bookings, autorización durable e importe/moneda siguen pendientes técnicos de conexión. El tratamiento conservador de históricos fue confirmado después por Leslie (§9), sin procedimiento de conciliación implementado. No rellenar versiones históricas suponiendo que se conoce el archivo revisado.

## 2. Inspección de la implementación disponible

- PgBookingRepository crea ocupaciones bajo booking_trip_locks por (cooperative_id, trip_id) y consulta activas RESERVED/SOLD para impedir solapamientos.
- PgBookingLifecycleRepository.receive bloquea primero una clave advisory de recepción por paymentProofId, luego viaje, reserva y ocupaciones ordenadas por seat_id. Expire entra por viaje, reserva y ocupaciones.
- booking-lifecycle.inspect solo admite PENDING_PAYMENT/EXPIRED y asientos RESERVED; no acepta todavía el estado confirmado.
- La migración activa de recepción admite PENDING_PAYMENT/EXPIRED y su restricción de expiración depende de esos estados. booking_seat_allocations ya admite RESERVED/SOLD.
- lockedBooking no devuelve todavía seat_id ni importes; la futura venta debe comprobar identidad/conjunto de asientos y total persistido, no solo número de filas.
- Payments persiste approval_requested_by/at con COALESCE; su guard de reemplazo exige ausencia de aprobación e intención. No persiste proofVersion ni ofrece la consulta pública de intención en esta base.

Inspección de fuentes, no ejecución del esquema en una base. No editar las migraciones originales para añadir venta. Diseñar una migración posterior al catálogo vigente, con validación estricta y pruebas de ida/rollback; el límite histórico de actualización de catálogo ya documentado no se convierte incidentalmente.

## 3. Propuesta de transacción y orden de bloqueos

1. Validar forma y vínculos de entrada, conservar bookingId opaco exacto sin normalización silenciosa. Verificar autorización mediante el límite de servicio/proveedor que se acuerde; conocer tres IDs no acredita permiso. No iniciar transacción ni vender si el proveedor carece de contrato seguro.
2. Obtener la intención durable y la versión fijada mediante API pública. Esta lectura puede preceder la transacción de Bookings solo si Payments garantiza que no cambia el contenido/versionado ni se revoca silenciosamente la intención mientras su resultado esté pendiente/incierto. Resolver ese protocolo antes de conectar; una lectura suelta no elimina la carrera.
3. BEGIN. Adquirir una exclusión por comprobante antes del bloqueo del viaje. Conservar el orden de recepción (comprobante → viaje → reserva → asientos) y comprobar si se reutiliza su misma clave o se coordina otra sin introducir orden inverso. No bloquear una tabla privada de Payments desde Bookings ni mantener una transacción de Payments esperando a la de Bookings.
4. Dentro del límite autorizado, consultar resultado de venta anterior por comprobante. Si coincide con todos los vínculos/versionado fijado, devolver el mismo resultado persistido sin recalcular precio/plazo ni duplicar efectos. Si hay desacuerdo de identidad, rechazar; no revelar datos de otra compra. La recuperación no evita los controles de autorización acordados.
5. Para venta nueva, leer el ámbito y bloquear booking_trip_locks; exigir que exista. Bloquear reserva y releer ámbito, luego ocupaciones ordenadas. Comprobar recepción ACCEPTED y accepted_proof_id coincidentes, estado confirmable, integridad temporal original y todas las identidades de asiento/pasajero/tramo. Una reserva UNKNOWN, expirada o sin recepción aceptada no se promociona por inferencia.
6. Obtener total/moneda desde datos persistidos de Bookings, sin recalcular con configuración actual ni datos del body. Confrontar con la validación revisada de Payments conforme al contrato pendiente; no suponer que Bookings comprueba una transferencia bancaria ni que la existencia de intención acredita un importe observado.
7. Convertir exactamente todas las ocupaciones esperadas RESERVED/active a SOLD manteniendo active=true; comparar conjunto y número actualizados. Persistir estado/resultado de venta y versión de forma atómica. Propuesta: resultado inmutable con unicidad por comprobante y por reserva; nombres definitivos de tabla/estado/DTO se fijan en implementación autorizada. No generar boleto ni actualizar estado de Payments en esta transacción.
8. COMMIT antes de devolver éxito. Si falla una actualización, restricción o resultado, ROLLBACK de todo. Pérdida de respuesta o fallo de COMMIT sin resultado verificable son inciertos; no liberar ni deshacer una posible venta. Reintento recupera el resultado persistido bajo el mismo contrato.

El bloqueo serializa; las restricciones únicas son defensa adicional y no sustituyen validación. Evitar una lectura de resultado fuera de exclusión seguida de escrituras sin revalidar. Read Committed con estos bloqueos es la propuesta mínima compatible con el código actual, sujeta a las pruebas reales siguientes.

## 4. Fixtures y observaciones comunes

Base PostgreSQL exclusiva NODE_ENV=test y sufijo _test. Crear reserva de al menos dos pasajeros con seatId distintos y tramo [0,2), total USD persistido, recepción aceptada estrictamente antes de expiresAt y prueba fuente controlada. No usar el confirmador simulado de Payments como evidencia de venta real.

Tomar snapshots antes/después de reserva, ocupaciones, resultado de recepción y futura venta. Comprobar IDs, tramos, total, active y cardinalidad; no limitarse a HTTP 200/true. Sin cambios esperados: comparar estado completo, incluidas fechas. Consulta de disponibilidad después debe seguir bloqueando tramos superpuestos y permitir adyacentes.

Las etiquetas de la tabla son referencias locales de escenarios, no IDs externos. Todos son previstos/no ejecutados como integración de venta. C = regla confirmada; P = expectativas clasificadas como propuestas al preparar esta matriz. Véase §9 para el acuerdo posterior de versiones/históricos; conservar P aquí documenta el estado inicial, no reabre esas decisiones. C tampoco significa que exista implementación.

## 5. Matriz de pruebas prevista

| Caso | Base | Preparación / acción | Resultado observable |
| --- | --- | --- | --- |
| Venta válida | C | Reserva/recepción coherentes, intención válida, dos asientos | Una venta; ambos SOLD y activos; mismo total y tramo |
| Reintento idéntico | C | Repetir confirmación ya persistida | Igual resultado original, una venta, fecha sin reescribir |
| Respuesta perdida | C | Permitir COMMIT, descartar respuesta y reintentar | Recupera venta; no duplica ni libera |
| Doble aprobación concurrente | C | Dos conexiones con mismo comprobante y reserva | Una transición y resultado estable para ambas |
| Reutilización de comprobante | C | Misma clave con otra reserva o cooperativa | No crea segunda venta ni modifica compras ajenas |
| Segundo comprobante | C | Reserva vendida, intentar con otro comprobante | Rechazo sin cambio de venta/ocupaciones |
| Recepción de otro comprobante | C | accepted_proof_id no coincide | Sin venta, asientos conservan estado anterior |
| Sin recepción aceptada | C | NOT_RECEIVED o historia UNKNOWN | Sin venta ni aceptación inventada |
| Reserva inexistente | C | Identificador no encontrado | Sin escritura y sin exposición de compras ajenas |
| Después del plazo inicial | C | Recepción válida y ahora > expiresAt | Venta permitida, sin extender/recalcular plazo |
| Recepción en el límite | C | Recepción nueva se evalúa exactamente en expiresAt | No se acepta; confirmación posterior no vende |
| Expiración ya consumada | C | Expirar antes de aceptar recepción | No vende ni reactiva ocupaciones |
| Expiración con revisión | C | Recepción aceptada; ejecutar venta y expiración concurrentes | Expiración no libera; venta persiste; todos SOLD activos |
| Expiración tras venta | C | Venta confirmada y siguiente lote de expiración | Sin liberación ni error falso de integridad |
| Recepción repetida tras venta | C | Repetir recepción ya ACCEPTED | Conserva resultado previo y venta, sin modificar asientos |
| Ocupación parcial incoherente | C | Un asiento ausente/inactivo/ajeno al resumen | Error de integridad, ninguna venta parcial |
| Tramo o asiento adulterado | C | Cardinalidad igual pero seatId/par distinto | Rechazo de integridad; no basta contar filas |
| Fallo al actualizar segundo asiento | C | Fallo controlado dentro de transacción QA | Rollback completo, primer asiento sigue RESERVED |
| Fallo al guardar venta | C | Falla inserción después de actualizar ocupaciones | Rollback de reserva, asientos y resultado |
| Disponibilidad después de venta | C | Consultar mismo asiento en [1,3) y [2,3) | Bloqueado en superpuesto; reutilizable en adyacente |
| Intención ausente/no autorizada | P | Fuente devuelve ausencia o contexto inválido | No vende; clasificación definitiva por acordar |
| Proveedor de intención falla | C | Timeout/error técnico, no ausencia confirmada | Incierto, sin aprobar ni liberar; error no se convierte en false definitivo |
| Reemplazo gana antes de intención | P | Reemplazar v1 por v2 y después solicitar aprobación | Intención fija v2; no vende contra evidencia v1 |
| Intención gana antes de reemplazo | P | Registrar intención v1 y después reemplazar | Reemplazo bloqueado, conserva archivo/versión/intención |
| Reemplazo falla | P | Archivo o persistencia nueva fallan | No acredita una versión nueva completada; conserva evidencia anterior válida |
| Versión cambiante del proveedor | P | Fuente entrega versión distinta de la fijada o venta existente | No se trata como mismo intento ni confirma silenciosamente |
| Intención incierta | P | Perder respuesta de venta y solicitar reemplazo | Sigue bloqueado; recuperar resultado antes de permitir cambios |
| Falta versión en histórico | P | Intención/archivo antiguo sin versión acreditada | No inventa v1 ni vende automáticamente; tratamiento pendiente |
| Resultado conocido y fuente temporalmente caída | P | Venta previa confirmada, cae lectura de intención | Recuperación/autoridad exactas por acordar; no declarar rechazo ni liberar |
| Diferencia de importe/moneda | P | Evidencia revisada no coincide con total USD persistido | No cambia precio ni confirma; contrato de observación/resolución pendiente |
| Traducción del adaptador | C | Resultado persistido / rechazo / timeout / false | true / BookingSaleRejectedError / BookingSaleUncertainError / incierto |
| Guardado final de Payments falla | C | Venta confirmada y falla marcar APPROVED | No revierte venta; reintento recupera y completa decisión original |

## 6. Cómo reproducir carreras sin depender del reloj del equipo

Seguir la barrera observada en receipt-expiration.test.js: una conexión auxiliar toma el lock real del viaje, lanzar operaciones desde conexiones distintas y consultar pg_blocking_pids/pg_stat_activity para constatar espera antes de soltar la barrera. Finalizar todas las promesas con allSettled y liberar conexiones en finally antes de limpiar fixtures. No probar carreras solo con Promise.all y un sleep arbitrario.

Para orden comprobante→viaje, diseñar barreras que no esperen erróneamente que ambas operaciones alcancen viaje: la segunda puede bloquearse primero en la clave de comprobante. Observar la cadena de bloqueadores o usar barrera específica por clave y resultado de una sola transición. Para reemplazo/intención la barrera corresponde a Payments y debe probarse con su proveedor real, cuando esté acordado; no acceder a sus tablas desde el caso de uso de Bookings.

La carrera recepción/expiración determina si se aceptó a tiempo. Venta/expiración con recepción ya ACCEPTED no es una competencia por llegar antes del plazo: la expiración debe abstenerse independientemente del orden. Preparar ambos órdenes y conservar reloj inyectado.

Para fallo después del primer asiento, usar instrumentación del harness/cliente QA para provocar el fallo dentro de la transacción; no añadir fallos a producción ni cambiar el esquema a mano. Asegurar que el fallo ocurrió dentro de la transacción y comparar snapshot completo posterior; no probar solo que se lanzó un error.

## 7. Archivos y siguiente implementación, aún no iniciada

Bookings: caso de uso confirm-sale, validación de dominio y resultado, repositorio transaccional, index.js y consumidores de ciclo de vida/lectura. Nombres concretos y migración posterior por definir tras el contrato. Pruebas nuevas unitarias e integración de BOOK-07 sin debilitar las de recepción/expiración. Revisar estado confirmado en lectura de pagos y consulta de compra, sin exponer datos extra.

Payments: puerto público de intención/versionado y adaptador de confirmación a coordinar con Shirley. No duplicar su trabajo ni importar infraestructura privada. Composición/arranque se verifican solo cuando se autorice conectar.

Antes de implementar conexión: concretar DTO/proveedor y autorización durable, observación de importe y recuperación; implementar el tratamiento de históricos ya confirmado. Versión e históricos están acordados según §9, no se solicita otra aprobación de esas reglas. No añadir escrituras apoyadas en un contrato simulado ni activar una API que devuelve true sin venta persistida.

## 8. Evidencia de esta preparación

Inspección estática de fuentes y catálogo, fetch de develop (ae88e0c) y consulta de PR abiertas sin resultados accesibles. No inspección de bases persistentes ni .env; ninguna migración modificada. Matriz de 32 escenarios previstos, no tests ejecutados, no cobertura medida. Sin dependencias, frontend, cambios funcionales, commit/push/merge o aprobación de implementación nueva. Lint/npm test/PostgreSQL no repetidos para documentación. git diff --check y enlaces locales comprobados en esta preparación. El rechazo anterior por límite de revisión automática no ejecutó el acceso fallido; el acceso actual sí permitió guardar este diseño en la carpeta original.

## 9. Acuerdos posteriores y avance limitado — 4 de noviembre de 2026

Leslie comparte una respuesta posterior de Shirley que declara registrado el acuerdo proofVersion, consulta pública de intención, bloqueo transaccional y traducción de resultado/errores. Los pendientes históricos incompatibles de versión quedan superados en cuanto a la regla comunicada; el DTO y código productivo nuevos no están publicados en develop ae88e0c. No se afirma haber leído sus cambios locales.

Leslie confirma además conservar archivos/decisiones antiguos, no asignar versión automáticamente ni procesar por el nuevo confirmador hasta conciliación documentada, manteniendo bloqueo de reemplazos con aprobación pendiente/incierta. El escenario de históricos deja de requerir decidir esa regla; todavía necesita implementación y pruebas reales. No se convierten bases o archivos en esta sesión.

Primer incremento autorizado bajo la petición de continuar: BOOK-07 §15, validación pura de intención y recuperación de resultado. No cubre transacciones ni los 32 escenarios de integración completos. Los 60 tests unitarios nuevos prueban solo representación interna, vínculo, versión, actor/fechas, exactitud y resultado inmutable. Las firmas internas de Bookings no son el DTO público de Payments: el adaptador futuro lo traducirá.

Siguen pendientes para conexión: proveedor productivo autorizado e identidad/contexto durable, correspondencia del DTO público, validación/resolución del importe observado y recuperación con fuente temporalmente inaccesible. No reinterpretar el acuerdo de versión como autorización para omitir esas comprobaciones. Siguiente incremento técnico: persistencia y transiciones atómicas bajo la spec conciliada, sin emitir true antes de COMMIT.
