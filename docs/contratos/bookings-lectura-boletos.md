# Lectura de venta de Bookings para emisión de boletos

Estado: implementación local para revisión, 4 de noviembre de 2026.
Spec: [BOOK-09](../specs/BOOK-09-lectura-boletos.md). Base actual 5c48d22 con hotfix #94 integrado (inicial 5ff50d9), rama feature/BOOK-09-lectura-venta-boletos. No integrada ni conectada todavía a un emisor real.

## Consumo interno

```js
const { createBookingTicketQueries } = require('./modules/bookings');
const bookingTicketQueries = createBookingTicketQueries({ pool });
const sale = await bookingTicketQueries.findSoldForTicket({ bookingId, cooperativeId });
```

El emisor recibe esta capacidad por composición y obtiene los identificadores de su operación autorizada. Validar una cadena no autentica al usuario: no exponer esta operación directamente a HTTP ni construir el tenant desde un body sin verificar. No se entrega el repositorio ni pool al resultado del módulo.

Entrada: objeto con exactamente bookingId y cooperativeId, cadenas no vacías. Se preservan literalmente los identificadores opacos; no se impone UUID ni se alteran mayúsculas/espacios del identificador como si fueran otra identidad.

Resultado para venta SOLD coherente:

```js
{
  bookingId, cooperativeId, tripId, fromPosition, toPosition,
  soldAt, // ISO UTC desde la venta persistida
  currency: 'USD',
  totalPriceCents,
  passengers: [{ seatId, fullName, identificationNumber, totalPriceCents }]
}
```

Objeto, lista y pasajeros son copias congeladas. Orden de pasajeros conservado del snapshot aceptado. No se exponen propietario, fecha de nacimiento, acreditaciones, comprobante, rutas de archivo, tokens o resumen íntegro. Nombre/documento son privados para el emisor del boleto; este contrato no permite publicarlos ni meterlos automáticamente en un QR.

null es indistinguible para reserva inexistente, de otra cooperativa o no vendida. No es una confirmación de pago ni un rechazo de pago. SOLD con snapshot histórico incompleto falla explícitamente, sin inventar importes, pasajeros o fechas.

## Lectura por propietario (BOLETOS-01)

Ampliación del 4 de noviembre de 2026 para el emisor de boletos, ver [BOLETOS-01](../specs/BOLETOS-01.md).

```js
const sale = await bookingTicketQueries.findSoldForOwner({ bookingId, ownerId });
```

Entrada: exactamente bookingId y ownerId, cadenas no vacías; ownerId sale de la sesión autenticada del cliente, nunca del body. La cooperativa se toma de la reserva persistida. Devuelve null indistinguible si la reserva no existe, es de otro propietario o no está vendida.

Resultado: el mismo de findSoldForTicket más `trip`, copiado del resumen comercial congelado:

```js
trip: {
  departureDate, // AAAA-MM-DD
  origin: { position, locationKey, departureAt },
  destination: { position, locationKey, arrivalAt },
}
```

No se expone ownerId. Una venta SOLD sin fecha de servicio, sin puntos del recorrido o con horas inválidas falla con BOOKING_TICKET_DATA_INTEGRITY_ERROR. findSoldForTicket no cambia.

## Datos confiables y coherencia

Una sola sentencia PostgreSQL obtiene la reserva y sus asignaciones activas desde tablas propias. Se verifica identidad, estado, formato comercial schemaVersion 2, moneda, tramo, fecha de venta, total persistido, correspondencia exacta de asientos SOLD y suma de precios individuales. No se consulta la tarifa actual ni tablas privadas de otros módulos. Ningún fallo técnico o dato incoherente se convierte en null.

La lectura no altera la reserva ni los asientos, no expira, no genera QR y no registra envío. Repetirla no duplica ventas. Tickets debe persistir su propia emisión idempotente y la entrega por correo; recibir esta respuesta no significa que ya emitió o envió un boleto.

## Errores

| Código | Clasificación |
|---|---|
| BOOKING_TICKET_QUERY_INVALID | 400, entrada inválida, sin I/O |
| BOOKING_TICKET_QUERY_UNAVAILABLE | 503, códigos temporales conocidos |
| BOOKING_TICKET_DATA_INTEGRITY_ERROR | 500, dato incoherente o fallo no clasificado como temporal |

Los mensajes no incluyen SQL ni datos privados. No existe ruta HTTP en este incremento; httpStatus es metadato para una traducción posterior controlada. Ausencia de pool válido falla al construir, sin datos simulados.

## Pendientes de integración con Shirley

Compartir spec/API y commit real cuando se publique. Verificar su consumidor real, payload de QR, clave de emisión y correo en BOLETOS-01; esa spec no está presente en la base consultada. No atribuir aprobación individual ni entrega completa por verificar solo este lector. Si necesita más campos, ampliar el contrato y sus pruebas antes de exponerlos.
