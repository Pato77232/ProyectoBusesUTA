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
