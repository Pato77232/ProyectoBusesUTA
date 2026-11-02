# Puertos de publicación comercial — ROUTE-SHEETS-07 sección 1

## SeatInventoryQueryPort

`listByBus({ busId, cooperativeId })` recibe UUID del contexto de servidor, nunca del comprador. Usa la API pública `fleet.seatQueries.listByBus`, que devuelve null si el bus no es visible o `{ busId, seats }`. Cada asiento contiene seatId, layoutSeatKey, label, deck, row, column, category y offered. Error técnico se propaga; no equivale a inventario vacío.

La fuente actual solo crea y consulta estos atributos, mediante una lectura SQL consistente del proveedor. Route Sheets conserva una copia comercial independiente, con UUID y revisión propios; no inventa revisión de configuración de Fleet. Si Fleet incorpora edición, se debe acordar sesión transaccional o lectura de configuración inmutable por versión antes de habilitarla para viajes. Esta garantía inicial fue confirmada por el solicitante, no por una aprobación nueva atribuida a Edwin.

## Sesión de publicación de RouteSheetTariffRepository

Además de frecuencia/programación/freeze, `withLockedSheet` entrega `commercialSession` con:

- `listSeries()`: series del grupo y cooperativa verificados, con ciclos por número y sus períodos/estado persistidos. No buscar otra cooperativa a partir de un ID enviado por cliente.
- `findPublished()`: manifiesto comercial persistido de la hoja o null si es historia anterior sin viajes; copia incoherente genera error. No captura fuentes actuales ni crea viajes al leer.
- `save({ programmingRecord, cycle, inventories })`: persiste serie/ciclo, inventarios, viajes y auditoría; devuelve `{ seriesId, cycleId, cycleNumber, tripIds }` con UUID generados en servidor. Requiere transacción ya abierta y no la confirma por su cuenta.

El adaptador es responsable del lock y del commit/rollback de programación validada, datos comerciales, tarifa congelada y estado de hoja como una unidad. Application/domain nunca reciben pg. Los reintentos publicados no llaman a `save` ni a Fleet. Estas firmas son internas de publicación; no constituyen las tripQueries de la sección 2.
