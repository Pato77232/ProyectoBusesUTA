# Puertos internos de lectura de disponibilidad — BOOK-02 T2a

Estas dependencias se inyectan en getSeatAvailability. No existe adaptador ni registro de producción todavía. El consumidor no debe importar las capas internas de viajes, flota, pagos u hojas de ruta.

## TripCatalog

findBookableById(tripId) devuelve Promise<null | snapshot>. null significa viaje inexistente o no comercializable. El snapshot mínimo contiene tripId, cooperativeId, routePointCount y seatIds. Debe proceder del viaje fechado y bus/plantilla realmente asignados; la frecuencia por sí sola no acredita estos datos. El caso de uso valida la identidad del viaje, copia el inventario y verifica los límites de la ruta.

## AllocationReader

listEffectiveByTrip({tripId, cooperativeId}) devuelve Promise<Array<allocation>>. Cada ocupación usa tripId, cooperativeId, seatId, fromPosition, toPosition y status RESERVED o SOLD conforme a BOOK-02 T1. La fuente debe incluir todas las ocupaciones efectivas, también las reservas protegidas por un comprobante en revisión. No debe depender de datos personales aportados por el cliente ni escribir o expirar durante la consulta.

El contexto proviene del catálogo, nunca de un cooperativeId enviado por el cliente. El dominio ignora ocupaciones ajenas al viaje/cooperativa o al inventario. El proveedor sigue siendo responsable del filtro y de la consistencia de lectura; una fuente incompleta no puede aceptarse como integración correcta. Los fallos se propagan; null/undefined no representan una lista de ocupaciones vacía.

## Salida y límites

El caso de uso devuelve solo {seatId, status}, en una lista inmutable. Se conserva el orden del inventario y no se exponen metadatos, pasajeros, propietarios, precios ni comprobantes. Ninguna consulta bloquea asientos: la confirmación debe volver a validar en una transacción de BOOK-03.

Los dobles de proveedor pertenecen exclusivamente a tests/unit/bookings. Las APIs definitivas de otros módulos y los adaptadores de producción siguen pendientes de acuerdo del equipo.
