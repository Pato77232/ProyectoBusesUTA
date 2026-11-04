# BOOK-02 T2a: consulta de disponibilidad mediante puertos

- Responsable: Leslie Coello.
- Revisor propuesto: PabloToapanta.
- Estado: especificada antes de implementar, por autorización de Leslie.
- Rama: feature/BOOK-02-T2a-consulta-disponibilidad.
- Base local: 20c7915, con los incrementos anteriores y develop 67ee38d.
- Reglas: RN-02, RN-12 y RN-40; arquitectura y convenciones del proyecto.

## Objetivo y alcance
Orquestar la lectura de un viaje comercializable, su inventario y ocupaciones efectivas para calcular disponibilidad por tramo con el dominio existente. Esta tarea no necesita inventar tablas de viajes ni modificar proveedores ajenos.

## Entrada y contratos internos
Entrada de consulta: objeto con tripId, fromPosition y toPosition únicamente. tripId es texto no vacío, normalizado con trim; posiciones enteras seguras no negativas, origen menor que destino. Rechazar campos extra, incluidos cooperativeId, seatIds y allocations; el inventario y la cooperativa proceden exclusivamente del catálogo de servidor.

Puerto tripCatalog.findBookableById(tripId): devuelve null si el viaje no existe o no se puede comercializar; en otro caso snapshot con tripId idéntico al solicitado, cooperativeId no vacío, routePointCount entero seguro al menos 2 y seatIds como lista explícita de identificadores únicos. El catálogo debe obtener la relación real de viaje fechado, bus y plantilla; no basta una frecuencia activa. El snapshot mínimo no se usa para calcular descuentos ni tarifas.

Puerto allocationReader.listEffectiveByTrip({tripId, cooperativeId}): devuelve ocupaciones efectivas conforme a BOOK-02 T1, incluidas reservas con comprobante en revisión. Solo se invoca después de validar el snapshot y que toPosition sea menor que routePointCount. Las lecturas no bloquean, escriben ni expiran reservas. Se reutiliza la política existente para ignorar ocupaciones de otro viaje/cooperativa o asientos ajenos, sin filtrar información personal.

Los puertos se documentan en el dominio. Son contratos internos propuestos; los adaptadores reales se implementarán mediante la API pública del proveedor cuando esté acordada. No registrar aún endpoints, composición ni repositorios simulados en producción.

## Resultado y errores
Resultado: lista inmutable de {seatId, status}, en el orden de la plantilla, sin metadatos del catálogo, identidades ni datos de comprobantes. No garantiza disponibilidad al confirmar: BOOK-03 revalida con bloqueo transaccional.

Entrada o snapshot inválido: BookingValidationError. Viaje ausente/no comercializable: BookingTripUnavailableError, código BOOKING_TRIP_UNAVAILABLE y mensaje genérico común. Errores de proveedores se propagan: nunca convertirlos en lista vacía ni asientos disponibles.

## Criterios de aceptación y pruebas
- Rechazar la consulta inválida antes de llamar a los proveedores.
- Verificar identidad del viaje y límite de ruta antes de consultar ocupaciones.
- Derivar cooperativa e inventario del catálogo; no admitir sustituciones en la entrada.
- Mantener superposición y adyacencia del dominio existente, y prioridad de SOLD.
- No mutar entrada, snapshot ni ocupaciones y no devolver información personal.
- Propagar fallos y rechazar datos incompletos; no ofrecer disponibilidad inventada.
- Probar llamadas y orden, viajes ausentes, límites, datos de proveedor inválidos y privacidad con dobles exclusivos de pruebas.

Ejecutar lint, formato de reservas y npm test con PostgreSQL aislado. Conservar las pruebas anteriores y reportar formato global preexistente sin modificar módulos ajenos. No aplica defecto inducido.

## Resultado comprobado
Implementación y pruebas completadas el 25 de octubre de 2026. 53 pruebas nuevas; npm test completo aprobado con 523 unitarias y 107 de integración (630 en total). Lint y formato de código/pruebas de reservas aprobados. El formato global sigue reportando los mismos 26 archivos ajenos a la tarea. Se usó un contenedor nuevo busesuta-leslie-book02 con base busesuta_test inicialmente vacía; se retiró al terminar. No se modificaron pruebas anteriores, migraciones, dependencias ni módulos ajenos.

Los puertos se documentan en backend/src/modules/bookings/domain/availability-ports.md. El caso de uso todavía no se compone en el servidor ni expone HTTP; requiere los proveedores reales pendientes. Esta tarea no acredita reserva, bloqueo, pago ni pantalla funcional. Revisión humana pendiente.
