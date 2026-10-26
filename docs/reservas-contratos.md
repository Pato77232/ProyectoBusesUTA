# Contratos de reservas pendientes de revisión

Responsable: Leslie. Revisor habitual: Edwin. Fecha: 20 de octubre de 2026.
Estado histórico inicial: propuesta interna. La actualización de coordinación con pagos del 26 de octubre de 2026 figura al final; los demás contratos siguen pendientes de sus responsables.

## Qué ya decidió Leslie

Las políticas de descuento, datos de invitado, comprobante en revisión y rechazo están en reservas-decisiones.md. Son decisiones de producto autorizadas por Leslie. Este documento solicita revisar las fronteras técnicas antes de implementar adaptadores de otros módulos.

## Datos que necesita bookings

| Responsable | Contrato requerido | Confirmación necesaria |
|---|---|---|
| David, viajes | Viaje fechado, cooperativa, origen/paradas/destino ordenados, fecha local de salida y si admite compra | Identificador real de viaje; no utilizar una frecuencia como viaje |
| David, tarifas | Precio por cada tramo del recorrido del viaje | Fuente del precio vigente y conversión exacta a centavos, sin valores del navegador |
| Edwin, flota | Identificadores de asientos del bus asignado al viaje y plantilla visual | Estabilidad de identificadores, relación asiento/bus y límites de ruta |
| Shirley, pagos | Recepción oportuna del comprobante y decisión de aprobación/rechazo | Operación transaccional coordinada con vencimiento y contrato de reintentos |
| Pablo, identidad/correo | Identidad de comprador registrado y acceso/recuperación de invitado | Sesión/CSRF y envío real de enlace secreto; no consultar reservas solo por cédula o UUID |

## Puerto interno propuesto para disponibilidad

El módulo bookings puede definir su propio puerto de lectura. Propuesta: `TripCatalog.findBookableById(tripId)` entrega un snapshot de servidor con `tripId`, `cooperativeId`, `routePointCount`, `seatIds` y fecha local de salida. El puerto de ocupaciones recibe siempre viaje y cooperativa del snapshot, y entrega ocupaciones efectivas, incluidas las que esperan revisión. Los nombres son internos de bookings: no imponen nombres de tablas, rutas o clases a otros módulos.

El adaptador se compone a través de la API pública del proveedor. Si el proveedor no existe, no se registra un endpoint con datos ficticios. El usuario no elige la cooperativa, el inventario ni el precio que se usa como autoridad.

## Verificación que se necesita para aceptar el contrato

- Viaje inexistente/no comercializable: respuesta acordada sin filtrar datos internos.
- Tramo inválido: rechazar antes de consultar ocupaciones.
- Cooperativas distintas: no cruzar escrituras ni datos personales.
- Dos tramos adyacentes no bloquean el mismo asiento; dos superpuestos sí.
- La disponibilidad es informativa: BOOK-03 revalida y bloquea todos los asientos en una sola transacción.
- Comprobante y expiración compiten por la misma reserva de manera atómica.
- Una respuesta repetida de pagos no duplica ventas ni libera una reserva confirmada.

## Estado comprobado del repositorio

La referencia remota develop se comprobó con la conexión GitHub de la app en 1de771370a06a7d478d4f4a0d8c56f209139070d. Hay frecuencias y cooperativas. La rama de flota de Edwin agrega grupos y su PR #10 está abierto; no es todavía un inventario de asientos por viaje. No se encontró un módulo de viajes ni de comprobantes en develop. No se ha enviado un mensaje externo a los integrantes ni se presume que aceptaron esta propuesta.

## Siguiente tarea

Confirmar estos contratos en revisión. Después implementar BOOK-02 T2 por partes: caso de uso contra puertos propios y pruebas, adaptadores reales, y finalmente HTTP/pantalla. La prueba con repositorios simulados no acredita integración de producción.

## Coordinación de reservas y comprobantes — 26 de octubre de 2026

### Decisión: recepción del comprobante frente a expiración

- **Estado:** Acordada en su comportamiento base; redacción técnica y firmas pendientes de revisión conjunta antes de implementar.
- **Fecha y participantes consultados:** 26 de octubre de 2026; Leslie y Shirley. Los mensajes de Shirley fueron transmitidos por Leslie en esta conversación; no se envió comunicación externa desde el asistente.
- **Reglas y specs:** RN-02, RN-40, RN-50/51, RN-53/54; BOOK-03, BOOK-06, BOOK-07 y PAGOS-01/02/03. PAGOS-02/03 son referencias de trabajo futuro de Shirley, no tareas implementadas por reservas.
- **Opciones y recomendación:** avisar antes de persistir puede dejar una reserva en revisión sin comprobante guardado. Persistir primero y reintentar solo en memoria pierde avisos al reiniciar. La opción acordada guarda comprobante y aviso pendiente de forma durable, y serializa en reservas la recepción y la expiración de cada reserva.
- **Respuesta humana y evidencia:** Shirley aceptó el aviso persistente, timeout sin borrado, rechazo definitivo y pruebas de carrera; propuso una operación coordinada desde reservas. Leslie autorizó documentar ese siguiente incremento. No se atribuye a Shirley aprobación de las firmas, nombres de columnas ni todos los detalles técnicos de esta redacción.
- **Decisión y justificación:** aplicar las garantías de las secciones siguientes; eliminar estados de resultado incierto y evitar liberar una reserva aceptada por recepción o una venta confirmada.
- **Responsables y revisión:** Leslie documenta la frontera de bookings; Shirley actualiza payments y sus pruebas. Pablo es revisor propuesto por Leslie; revisión del contrato por ambos módulos pendiente. No equivale a aprobación del PR ni a código disponible.
- **Aceptación:** matriz de escenarios siguiente, que deberá convertirse en pruebas ejecutables al implementar.
- **Trabajo dependiente:** persistencia de reserva/ocupaciones, fuente real de viaje/asiento, autorización y operación transaccional. Independiente: revisión de estas specs y del PR #15.
- **Reemplaza:** la propuesta de notificar recepción antes de persistir el comprobante; no modifica RN-50/51 ni amplía el plazo.

### Responsabilidades y orden de operaciones

1. Payments valida el archivo y guarda su referencia y el aviso pendiente de recepción de forma durable. Antes de notificar, el comprobante debe poder recuperarse. La atomicidad de comprobante/aviso y la limpieza de archivos huérfanos deben resolverse en su implementación; no basta una promesa o temporizador en memoria.
2. Payments conserva la misma identidad de operación en los reintentos y llama a la API pública de bookings. Los parámetros definitivos siguen pendientes; el contrato debe correlacionar reserva, comprobante, operación y contexto autorizado.
3. Bookings verifica autorización y cooperativa, obtiene la coordinación exclusiva de esa reserva y consulta el resultado persistido de la misma operación. Si ya se aceptó, devuelve esa aceptación sin repetir efectos, incluso después del plazo. Un reintento no puede cambiar de reserva/comprobante ni el contenido de la operación.
4. Para una operación nueva, bookings vuelve a comprobar estado y plazo dentro de esa coordinación. Solo acepta si la reserva sigue pendiente y la hora autoritativa del servidor, evaluada después de adquirir la coordinación, es estrictamente anterior al vencimiento. Registra la aceptación y el estado de revisión en la misma transacción; el resultado exitoso requiere commit durable.
5. El coordinador de expiración usa la misma coordinación por reserva, vuelve a leer el estado y solo expira una reserva pendiente sin recepción aceptada cuando ahora es mayor o igual al vencimiento. La transición y la liberación de sus ocupaciones son una sola operación transaccional e idempotente. No expira revisiones ni ventas.
6. Payments registra el resultado del aviso. Ante timeout, caída o resultado desconocido mantiene comprobante y aviso pendiente para reintentar o consultar la decisión autoritativa; nunca interpreta un timeout como rechazo ni vuelve a avisar con otra identidad.
7. Solo un rechazo definitivo por plazo vencido/reserva expirada permite la compensación acordada: retirar el archivo y revertir la carga no aceptada. Los detalles del estado compensado pertenecen a payments; no se borra un comprobante de una aceptación previa ni se oculta una decisión de auditoría. Un fallo de compensación debe quedar recuperable.

Guardar el archivo en payments NO es recepción aceptada por bookings ni concede una extensión del plazo. Si el aviso se procesa por primera vez después del límite, se rechaza aunque payments lo hubiera guardado antes. Si expiración obtiene primero la coordinación pero aún no venció, no expira y no constituye una victoria por sí sola. El resultado lo determina una transición válida confirmada, no el orden de llegada de solicitudes.

### Operaciones públicas previstas, todavía no implementadas

| Operación | Garantía requerida |
| --- | --- |
| findForPayment | Lectura autorizada de propietario, cooperativa, estado, plazo y total final en centavos. No recalcula tarifas ni acepta cooperativa del navegador. |
| markPaymentProofReceived | Serialización con expiración, comprobación de plazo del servidor y resultado durable e idempotente. No vende asientos. |
| confirmSale | Aprobación autorizada: reserva y ocupaciones pasan a venta de forma atómica e idempotente; no duplica venta ni efectos en reintentos. Contrato de boleto/recuperación pendiente de PAGOS-02 y BOOK-07. |
| releaseBooking | No libera por simple demora de revisión. Sí libera por rechazo autorizado y justificado según la política ya definida, de forma atómica e idempotente; una venta confirmada queda protegida. El vencimiento sin recepción lo ejecuta el coordinador de bookings. Motivos y firma concretos pendientes de revisión. |

Los nombres están acordados; conocer bookingId no es autorización. No se publican endpoints ni se importan repositorios internos de otro módulo. Ningún dato de reloj, rol, cooperativa o decisión aportado por el navegador acredita la transición. Las propuestas de firmas deben incluir la identidad de operación y contexto verificado, sin fingir que el puerto actual de payments ya los implementa.

### Matriz de pruebas obligatorias para la conexión futura

Todos estos escenarios están **Pendientes de implementación y ejecución**. Esta tarea documental no aporta evidencia de concurrencia real.

| Caso | Resultado esperado |
| --- | --- |
| Falla el guardado previo al aviso | No se registra recepción en bookings; payments recupera/limpia su intento conforme a su política sin declarar UPLOADED exitoso. |
| Comprobante durable y aviso falla antes de llegar a bookings | Aviso sigue pendiente tras reiniciar. Reintento con la misma identidad; se evalúa el plazo al procesarlo por primera vez. |
| Bookings confirma la recepción en base de datos, pero se pierde su respuesta | Payments conserva el archivo; al reintentar, incluso después del plazo, obtiene la misma aceptación sin duplicar efectos. |
| Comprobante guardado a tiempo, primer aviso procesado después del límite | Rechazo definitivo: guardar no amplió el plazo ni reactivó una reserva. Compensación recuperable en payments. |
| Recepción acepta antes del límite y expiración corre después | La reserva permanece en revisión, conserva todas sus ocupaciones y no se vende todavía. |
| Expiración confirma primero al vencimiento | Reserva expirada, todas las ocupaciones liberadas una vez; recepción posterior rechazada sin reactivar. |
| Recepción en el instante exacto del vencimiento | Se rechaza una operación nueva; si no existe recepción previa aceptada, la reserva es elegible para expirar. |
| Recepción comenzó antes pero esperó la coordinación hasta vencer | Se comprueba el reloj después de esperar; no se acepta por una hora capturada antes del bloqueo. |
| Dos coordinadores o dos avisos iguales concurrentes | Una sola transición efectiva; resultado consistente sin duplicar liberaciones ni recepción. |
| Mismo identificador de operación con otro comprobante/reserva | Conflicto sin modificar la decisión original ni filtrar datos ajenos. |
| Cooperativa o contexto no autorizado, incluido un reintento | Sin lectura o transición autorizada; no exponer el resultado de otro propietario. |
| Rechazo autorizado con justificación durante revisión | Finaliza como rechazada y libera todos sus asientos una vez; no equivale a expirar por ausencia. |
| Demora de revisión o intento de liberar venta confirmada | No libera los asientos; una revisión no vence por el plazo inicial. |
| Falla la transacción o la compensación | Ninguna transición parcial confirmada; resultado desconocido se resuelve con reintento/consulta. Payments conserva evidencia para recuperar la compensación. |

### Detalles que aún deben cerrarse

- Firmas y nombres de campos/estados/códigos; correlación estable, unicidad y persistencia de decisiones de operación.
- Esquema y mecanismo de coordinación por reserva en PostgreSQL; límites transaccionales entre reserva, ocupaciones y decisión. No se edita una migración existente.
- Persistencia y ejecución del aviso pendiente en payments, política de reintentos y recuperación; no se fijan intervalos ni máximos inventados.
- Contrato de autorización de cliente/invitado y de la llamada interna; tratamiento de errores de autorización, conflictos y fallos técnicos, separados del rechazo definitivo por expiración.
- Compensación y auditoría de archivos/comprobantes, aprobación/boletos y rechazo en PAGOS-02/03. No implementados por esta tarea.

### Calidad y alcance de esta entrega

Contrato pequeño por consumidor, responsabilidades separadas y adaptadores por APIs públicas (S, I y D). Las futuras implementaciones y dobles deben respetar el mismo orden y errores (L); no se añade una jerarquía para casos hipotéticos (O). Sin interfaz en este alcance: los futuros mensajes deben distinguir revisión, aviso pendiente, rechazo definitivo y fallo recuperable, sin prometer compra confirmada ni devolución automática. Pruebas visuales y de usabilidad pendientes de las pantallas.
