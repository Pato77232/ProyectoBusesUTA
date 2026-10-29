# Contratos de reservas pendientes de revisión

Responsable: Leslie. Revisor habitual: Edwin. Fecha: 20 de octubre de 2026.
Estado: propuesta interna del módulo bookings; no aprobada por David, Edwin ni Shirley.

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

## Actualización comprobada el 25 de octubre de 2026 — BOOK-01 T2

Base revisada: develop 67ee38d947058be53e17a0479f4404b1d3c42bf6, que incorpora grupos de buses y hojas de ruta. Las secciones anteriores son evidencia histórica de las referencias y ejecuciones allí indicadas.

| Proveedor | API pública disponible | Qué sigue pendiente para reservas |
| --- | --- | --- |
| Flota | createFleetModule devuelve busGroupQueries.findById y findByCooperativeId | Buses reales y plantilla con identificadores de asientos; un grupo no es un inventario |
| Frecuencias | createFrequenciesModule devuelve findActiveByRoute y router | Contrato de viaje fechado, recorrido y tarifas autorizadas para la cotización |
| Hojas de ruta | createRouteSheetsModule devuelve router; el caso de ventana de compra queda interno | API pública de consulta de viaje comercializable y relación estable con asignación, bus y fecha |
| Pagos | No hay implementación en esta base; PAGOS-01 continúa en PR #11 | Acuerdo de operaciones transaccionales de recepción, expiración, aprobación y rechazo |
| Reservas | Funciones de dominio; aún no hay index.js, repositorio, tabla ni endpoints | Contratos públicos, persistencia, propiedad y bloqueo transaccional |

La ventana de compra de hojas de ruta expresa un horizonte de calendario; no sustituye el plazo de 3 a 5 minutos para subir comprobantes. Tampoco acredita disponibilidad de un asiento.

El arranque server.js compone auth, tenants y fleet, pero todavía no frequencies ni route-sheets. Esta revisión no modifica módulos ajenos ni presenta esos endpoints como disponibles en el servidor real.

El adaptador interno de hojas de ruta contempla consultas hasPassengersForBusOnRouteSheet y hasPassengersForAssignment sobre un bookingRepository inyectado. Es una expectativa del consumidor, no una API de reservas implementada ni un acuerdo ya aceptado. Debe acordarse antes de conectar los módulos; no importar repositorios internos entre módulos.

Siguiente incremento: BOOK-02 T2a, definir el puerto interno TripCatalog y el caso de uso de disponibilidad con pruebas de contrato. Los adaptadores de producción y el endpoint quedan pendientes de las fuentes reales; no se inventan tablas de viajes ni disponibilidad ficticia. En paralelo, acordar con Shirley la reserva persistida y sus transiciones antes de implementar expiración o venta.
