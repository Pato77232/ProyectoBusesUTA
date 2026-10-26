# BOOK-06: Plazo y vencimiento de reservas

- **Responsable:** Leslie
- **Revisor:** Edwin
- **Módulo:** bookings
- **Estado:** T1 autorizada para política pura RN-50/51; el principio de coordinación de recepción y expiración está acordado con Shirley; contrato público e integración pendientes.
- **Dependencias:** BOOK-01; BOOK-03 y Shirley para T2/T3.

## 1. Objetivo
Liberar reservas cuyo plazo para subir comprobante venció sin comprobante.

## 2. Reglas
RN-50 exige configuración entre 3 y 5 minutos. RN-51 exige ausencia de comprobante para expirar. Un comprobante en revisión no equivale a ausencia.

## 3. Tareas
T1 política pura de plazo con reloj explícito; T2 operación transaccional de expiración; T3 ejecución periódica y aviso de tiempo. Rama inicial feature/BOOK-06-T1-plazo-reserva.

## 4. Flujo
T1 valida plazo en segundos entre 180 y 300, recibe instante de inicio decidido por el caso de uso y calcula expiresAt. Decide vencimiento comparando ahora >= expiresAt y comprobante ausente. Sin valor por defecto oculto.

## 5. Datos
Funciones internas reciben Date válido, segundos enteros y hasPaymentProof booleano explícito. Devuelven Date nuevo o booleano; no mutan entradas ni leen process.env desde domain. Aplican solo a una reserva pendiente elegible, condición que T2 deberá comprobar en base de datos.

## 6. Endpoints
Ninguno en T1. Expirar no requiere endpoint público ni confía en el reloj del navegador. El temporizador visual solo informa.

## 7. Criterios de aceptación
- [ ] Plazos 180 y 300 se aceptan; valores fuera de rango o no enteros se rechazan.
- [ ] Antes del límite no vence; en el límite sin comprobante vence.
- [ ] Con comprobante no se expira por esta regla.
- [ ] Un dato ausente no se interpreta como ausencia de comprobante.
- [ ] T2 serializa por reserva la recepción aceptada del comprobante y la expiración: solo una transición puede ganar y liberar asientos o conservarlos en revisión según el resultado.
- [ ] Una recepción aceptada antes del vencimiento conserva los asientos durante la revisión; una reserva ya expirada o cuyo plazo venció antes de aceptar recibe rechazo definitivo.
- [ ] Repetir una recepción aceptada devuelve el resultado aceptado aunque la respuesta anterior se haya perdido y el reintento llegue después del vencimiento.
- [ ] T2 libera de forma atómica e idempotente y no toca reservas vendidas.

## 8. Casos borde
Reloj inválido, Date fuera de rango, plazo ausente, recepción y expiración concurrentes, reintento tras timeout y límite exacto. La recepción solo se acepta si la transacción de reservas la confirma antes del vencimiento; en `now >= expiresAt` la expiración puede ganar. No decidir aquí cuánto dura la revisión.

## 9. Pruebas
Unitarias de T1 con fechas fijas. T2: pruebas PostgreSQL de recepción y expiración concurrentes, resultado único, límite exacto y reintento idempotente después de perder la respuesta de una recepción aceptada; verificar que una recepción aceptada conserva asientos y una expiración ganadora rechaza definitivamente la recepción. T3: ejecución automática y visualización sin extender el plazo.

## 10. Preguntas abiertas
Contrato y parámetros públicos de la recepción (incluido contexto autorizado), forma de correlacionar reintentos y operación de expiración. El principio de coordinación transaccional por reserva ya está acordado con Shirley. Tratamiento de rechazo y duración de revisión se especifican en sus tareas correspondientes.

## 11. Defecto inducido
No aplica.

## Aclaración para revisión documental
Las decisiones de producto de `docs/reservas-decisiones.md` fueron seleccionadas por autorización de Leslie y cierran las preguntas correspondientes de este borrador. No se atribuye aprobación a otros integrantes. Los contratos técnicos pendientes están en `docs/reservas-contratos.md`; esta actualización no implementa el contrato público de `bookings`. El trabajo de pagos se documenta por separado en [PAGOS-01](PAGOS-01.md).

## Acuerdo compartido con payments
- Estado: acordado por Leslie y Shirley el 26 de octubre de 2026; parámetros, firma y contexto autorizado quedan pendientes del contrato técnico.
- Recepción del comprobante y expiración compiten dentro de la misma coordinación transaccional por reserva.
- Si `bookings` acepta la recepción antes del vencimiento, conserva los asientos durante la revisión. Si la reserva ya expiró o el plazo venció antes de aceptar, responde con rechazo definitivo.
- Una repetición idempotente de una recepción que ya fue aceptada devuelve el resultado aceptado aunque llegue después del plazo. Un timeout no es rechazo definitivo: payments reintenta la misma operación y no compensa por resultado incierto.
- Pruebas requeridas: concurrencia de ambas operaciones, límite exacto del plazo y reintento después de perder la respuesta de una aceptación.
- Fuente: confirmación de Leslie compartida por Shirley en esta tarea; ver también [PAGOS-01](PAGOS-01.md) y [BOOK-07](BOOK-07.md).
