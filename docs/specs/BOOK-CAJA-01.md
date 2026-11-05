# BOOK-CAJA-01 — contrato de Reservas para venta en efectivo

Responsable de esta propuesta: Leslie. Consumidor: Shirley/PAGOS-CAJA-01.
Base: develop 5b0ecb6. Estado: propuesta autorizada por el solicitante para PR
borrador; sin aprobación individual del equipo ni implementación de venta.
Se excluye compra invitada (Pablo), interfaz/contabilidad de Pagos y correo.

## Decisiones propuestas para revisión

1. Primera entrega: efectivo sobre reserva propia de un cliente registrado,
   creada con resumen aceptado y acreditación vigente por el flujo existente.
   No crear CUSTOMER ficticios ni permitir al oficinista elegir propietario al
   confirmar una venta. La venta totalmente presencial sin cuenta es otro
   alcance que requiere el contexto de compra de Auth.
2. El comprador elige CASH al aceptar el resumen; el servidor persiste el método
   como intención inmutable. Reservas fija expiresAt con el mismo plazo inicial
   configurable de 3–5 minutos; no se reinicia al abrir caja ni al reintentar.
   No convertir automáticamente una transferencia pendiente en efectivo.
3. Sin cobro confirmado al vencer, expiración atómica libera asientos y deja
   auditoría. Una recepción de comprobante pertenece a un método no efectivo;
   el proceso de expiración debe distinguir métodos, nunca fingir RECEIVED.
4. Antes del vencimiento, cancelación explícita del comprador propietario o
   CLERK del tenant libera únicamente RESERVED, con actor y motivo. Una venta
   SOLD no se cancela ni se reembolsa por este comando. Abandonar/cerrar la
   pantalla no es una cancelación.
5. El oficinista registra el importe exacto del resumen congelado en USD. Sin
   pagos parciales, recargos ni descuentos manuales; un total cero requiere la
   tarea de emisión sin pago y no se simula efectivo.
6. Un recibo de caja tiene identidad persistida en Pagos. Mismo recibo y misma
   reserva/contexto recuperan el resultado; misma clave con otros datos o dos
   recibos distintos para la reserva provocan conflicto. No volver a cobrar
   tras resultado incierto: primero recuperar el mismo recibo.

## Puerto propuesto de Bookings

`cashSales.confirm({bookingId, cooperativeId, cashReceiptId, actorId,
amountCents, currency, expectedSummaryRevision})` es interno, inyectado a Pagos;
no acepta contexto de autorización fabricado por navegador. Pagos obtiene actor
y tenant de Auth y verifica CLERK. Bookings verifica sus vínculos persistidos.
Un receptor sin fuente autenticada no se compone en servidor.

Resultado: `{bookingId, cashReceiptId, status: 'SOLD', soldAt}`. Repetición
idéntica devuelve el resultado persistido. Errores de contrato propuestos:
BOOKING_CASH_NOT_FOUND (ausente/ajena indistinguibles), BOOKING_CASH_CONFLICT
(método, estado, importe, revisión o vínculo incompatibles),
BOOKING_CASH_EXPIRED y BOOKING_CASH_UNCERTAIN (no permite compensación ciega).
No se exponen SQL, manifiesto ni información de otro tenant.

## Persistencia y concurrencia antes de implementar

Migración nueva: método de cobro y vínculo auditado al recibo, auditoría de
cancelación y estados necesarios. No reutilizar accepted_proof_id ni marcar
proof_reception_state=RECEIVED para satisfacer restricciones de depósito.
Las restricciones actuales exigen RECEIVED para SOLD/REJECTED: deben evolucionar
explícitamente mediante migración nueva para permitir CASH sin comprobante.
Down con ventas/auditoría de caja debe rechazarse sin borrar filas.

Usar el bloqueo por viaje/tenant y el orden de locks que aplica Reservas;
releer reserva bajo bloqueo. Comparar método, propietario persistido, importe,
revisión y clock_timestamp() antes de la transición. Mantener coherencia de
SOLD y todas las asignaciones en una transacción, con verificación de cantidad.
Vencimiento, cancelación, carga y confirmación tienen un solo ganador. Mantener
separadas las tablas de Pagos; coordinar recibo durable, idempotencia y
recuperación por API pública, no con SQL cruzado.

## Entrega por integrante y aceptación

Leslie: persistencia/método, confirmador/cancelación de reservas, bloqueo y
expiración compatibles. Shirley: recibo efectivo, autorización HTTP de caja,
listado/interfaz y recuperación del cobro. Pablo: identidad/tenant si se amplía
el contexto. No atribuir aceptación a esas personas por esta propuesta.

Secuencia: revisar criterios → spec aprobada en ambos módulos → Reservas →
Pagos consumidor → recorrido conjunto. Ningún endpoint de efectivo se activa
con esta PR documental. Antes de activar se deben comprobar al menos carreras,
tenant, vencimiento exacto, repetición, respuesta perdida, rollback, rechazo de
comprobante en CASH y cancelación de SOLD. Las suites no se ejecutan ni se crean
por petición expresa en esta sesión. Revisión humana pendiente. Codex asistió
la preparación; no se declara cobro implementado ni probado.
