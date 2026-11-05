# BOOK-10 — consumidor de espacios accesibles en Reservas

Responsable de este incremento: Leslie. Base develop 5b0ecb6. RN-12/40/43.
PR borrador, revisión funcional con Edwin/David pendiente. Implementa solo el
lado Bookings y su pantalla; no altera Fleet o snapshots históricos de Route
Sheets. No compra invitada ni caja. Sigue las decisiones de BOOK-10 y aplica
frontend/DESIGN.md con controles y estados escritos.

## Contrato nuevo propuesto al productor

La lectura pública findPurchaseContext conserva seatIds/seats para NORMAL/VIP.
Para habilitar venta accesible debe emitir explícitamente
accessibleInventoryVersion: 2 y accessibleSpaces: [{seatId, category:
'ACCESSIBLE', offered:false, reservable:true}], ligados al inventorySnapshotId
e inventoryRevision congelados del viaje. IDs UUID en minúscula únicos, sin
duplicados entre colecciones. Colección sin versión o versión desconocida falla
con integridad, no se interpreta como permiso. El DTO anterior no habilita
espacios accesibles. No se consultan asientos actuales de Fleet para completar
un viaje histórico.

## Consumidor implementado

GET /api/v1/bookings/accessible-availability requiere CUSTOMER y no-store; usa
catálogo de compra validado y ocupaciones reales por tenant/viaje/tramo. La
pantalla consulta esa colección solo si se marca el control de accesibilidad;
identifica claramente las posiciones y no impone acompañante. Un acompañante
ocupa un asiento normal separado de la misma reserva atómica existente.

El catálogo interno incorpora solo posiciones autorizadas explícitamente por el
productor. Resumen/creación revalidan ese catálogo y usan las asignaciones y
bloqueos existentes. ACCESSIBLE conserva categoría, identidad y tarifa regular
sin recargo VIP; la categoría sola no concede descuento. La acreditación
existente sigue decidiendo beneficios. El snapshot de compra conserva versión
del contrato accesible cuando corresponde, sin cambiar el schemaVersion 2 de
compra que ya consumen Boletos y Pagos.

## Lo que sigue bloqueado

Route Sheets en develop aún no entrega este DTO ni congela la colección nueva;
por tanto no se habilitan ventas accesibles reales con el proveedor actual. La
publicación/restauración versionada es trabajo del productor con David/Edwin;
esta PR no inventa asientos ni marca offered:true en ACCESSIBLE. Revisar el
contrato con ellos antes de integrar/activar. No se presenta la función como
venta completa de punta a punta.

Por instrucción expresa no se añaden ni ejecutan suites. Solo lint, sintaxis,
formato y diff; siguen pendientes contrato con productor, integración concurrente,
autorización/tenant, restauración histórica, rollback y QA de navegador. Codex
asistió la implementación. No hay migración en este incremento de consumidor.
