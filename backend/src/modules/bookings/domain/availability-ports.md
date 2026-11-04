# Puertos internos de lectura de disponibilidad — BOOK-02 T2a

Estas dependencias históricas se inyectan en getSeatAvailability. El incremento por tramo actual se describe al final; implementación local, revisión/integración pendientes. El consumidor no debe importar las capas internas de viajes, flota, pagos u hojas de ruta.

## TripCatalog

findBookableById(tripId) devuelve Promise<null | snapshot>. null significa viaje inexistente o no comercializable. El snapshot mínimo contiene tripId, cooperativeId, routePointCount y seatIds. Debe proceder del viaje fechado y bus/plantilla realmente asignados; la frecuencia por sí sola no acredita estos datos. El caso de uso valida la identidad del viaje, copia el inventario y verifica los límites de la ruta.

## AllocationReader

listEffectiveByTrip({tripId, cooperativeId}) devuelve Promise<Array<allocation>>. Cada ocupación usa tripId, cooperativeId, seatId, fromPosition, toPosition y status RESERVED o SOLD conforme a BOOK-02 T1. La fuente debe incluir todas las ocupaciones efectivas, también las reservas protegidas por un comprobante en revisión. No debe depender de datos personales aportados por el cliente ni escribir o expirar durante la consulta.

El contexto proviene del catálogo, nunca de un cooperativeId enviado por el cliente. El dominio ignora ocupaciones ajenas al viaje/cooperativa o al inventario. El proveedor sigue siendo responsable del filtro y de la consistencia de lectura; una fuente incompleta no puede aceptarse como integración correcta. Los fallos se propagan; null/undefined no representan una lista de ocupaciones vacía.

## Salida y límites

El caso de uso devuelve solo {seatId, status}, en una lista inmutable. Se conserva el orden del inventario y no se exponen metadatos, pasajeros, propietarios, precios ni comprobantes. Ninguna consulta bloquea asientos: la confirmación debe volver a validar en una transacción de BOOK-03.

Los dobles de proveedor pertenecen exclusivamente a tests/unit/bookings. Las APIs definitivas de otros módulos y los adaptadores de producción siguen pendientes de acuerdo del equipo.


## SegmentCatalog: incremento de disponibilidad real, BOOK-02-L02 §15

Puerto adicional de solo lectura: findBookableForSegment({tripId, fromPosition, toPosition}). El adaptador route-sheet-availability-catalog recibe exclusivamente tripQueries público de Route Sheets. Valida el snapshot comercial y devuelve el mínimo {tripId, cooperativeId, routePointCount, seatIds} inmutable antes de leer ocupaciones. No importa código privado de otros módulos ni usa Fleet actual en lugar de la copia congelada.

La entrada pública no cambia. La composición del servidor exige findBookableForSegment y lo pasa como availabilityQueries a createBookingsModule. El catálogo antiguo se conserva para los consumidores internos que lo inyectan explícitamente; no se intenta como alternativa si el proveedor por tramo falla, devuelve null o contiene datos incoherentes.

Se comprueban relaciones UUID, par/identidad exactos, revisiones positivas, referencia de inventario, recorrido ordenado y fechas ISO reales con zona, boardingAt del punto elegido y límite confirmado. La elegibilidad temporal la decide el proveedor con su reloj. No se recalculan precios ni ventanas en el consumidor; tarifa/política no se exponen en la respuesta de disponibilidad.

null -> viaje no comercializable; error de consulta -> error, nunca lista libre. Errores conocidos se traducen a validación/indisponibilidad, snapshot incoherente a integridad 500 y desconocidos al manejo seguro general. AllocationReader y la política RESERVED/SOLD/adyacencia permanecen como estaban. La disponibilidad sigue siendo informativa y no sustituye la revalidación transaccional de creación.
