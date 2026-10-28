# Puerto privado de persistencia — BOOK-03 T2

reserve({tripId, cooperativeId}, prepare) adquiere la coordinación de inventario en una transacción. Después llama una vez a prepare, que devuelve {input, context} de BOOK-03 T1. El futuro caso de uso debe resolver las fuentes reales, autorización, acreditación, versión de resumen y hora de servidor dentro de ese paso; prepare no es un callback del navegador. Si el contexto cambia de viaje/cooperativa se rechaza. Una excepción revierte reserva y todas las ocupaciones. Una llamada repetida con ID existente da BOOKING_ALREADY_EXISTS, no éxito idempotente.

listEffectiveByTrip({tripId, cooperativeId}) implementa la lectura de ocupaciones del puerto de disponibilidad. findByOwner({bookingId, cooperativeId, ownerId}) es una consulta privada autorizable por el futuro caso de uso, no findForPayment ni una ruta pública. Un ID sin propietario/cooperativa no basta para leer.

Las ocupaciones activas incluyen las que esperan revisión y no expiran por una lectura. Las transiciones de pago y liberación deben coordinar estado y ocupaciones de forma transaccional conforme a BOOK-06/07; no están implementadas por este repositorio inicial.

La elección de catálogo y asientos delegada por Leslie consta en docs/specs/BOOK-03-T2.md. No hay proveedor ficticio en producción, index.js ni montaje HTTP en esta entrega. La garantía de no superposición exige que todo escritor de inventario use la misma coordinación por viaje; no se autoriza SQL externo que la eluda.
