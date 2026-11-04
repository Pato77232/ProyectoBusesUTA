# INTEG-01-T6b: acreditación manual de beneficios

Estado: implementación autorizada por Edwin el 4 de noviembre de 2026; revisión humana pendiente. ID local subordinado a INTEG-01, sin ticket externo. Ante la consulta de acuerdos responde «Si ya lo acordaron como lo hagas esta bien» y delega la concreción. Al precisar el contrato confirma expresamente «Confirmo revisión específica hasta el embarque». Se registra esta autorización de Edwin; no se inventan respuestas individuales ni aprobación de PR de David o Leslie.

## Contrato aprobado

CLERK confirma manualmente nacimiento/discapacidad para un comprador, viaje, tramo y pasajeros concretos. Guardar actor, fecha y decisiones; vigencia hasta el embarque del tramo. Cambiar identidad, nombre, nacimiento, asiento, viaje o tramo requiere otra revisión. No almacenar fotografías ni documentos; conservar solo huella del contexto y decisiones. RN-02/43 y BOOK-03-L03-T1 siguen vigentes: revisar no reserva ni vende, descuentos monetarios no cambian. Sin interfaz nueva ni Chofer/Controlador.

POST `/api/v1/booking-benefit-reviews`, con Auth CLERK/CSRF y JSON: ownerId, tripId, fromPosition, toPosition, seatIds, passengers (contrato de compra) y decisions [{seatId,birthDateVerified,disabilityVerified}]. Tenant y actor salen de Auth; la fuente comercial real determina cooperativa, inventario y embarque. Un viaje ajeno o no comercializable responde 404; formato inválido 400; rol/CSRF 403. No se devuelve PII ni la huella. Una decisión negativa se registra pero no habilita una tarifa basada en nacimiento sin verificar. Una revisión posterior queda como nueva fila auditable; se utiliza la última para el contexto exacto.

El verificador productivo de Reservas consulta esas decisiones, nunca acepta flags del comprador; sin revisión o al vencer devuelve BOOKING_BENEFIT_REVIEW_REQUIRED (409), sin crear reservas. Fallos técnicos no se convierten en una acreditación favorable. El proveedor ausente conserva 503 en composiciones que no tienen catálogo comercial. Los dobles explícitos de QA permanecen inyectables. Migración nueva al final del catálogo, sin editar migraciones existentes; down impide perder revisiones persistidas.

## Verificación

Pruebas de rol/CSRF/tenant, contexto exacto, decisiones negativas, vigencia estricta, auditoría y ausencia de PII; cotización/creación con fuente real, sin bypass del acreditador. Mantener serialización de reserva y relectura comercial. Verificar migración y reversión protegida, catálogo, lint, formato, unitarias e integración aislada. Adaptar exclusivamente la expectativa antigua 503 sin proveedor comercial a 409 sin revisión cuando se compone este proveedor real; conservar cero escrituras. Sin dependencias nuevas, commits ni publicación.

## Implementación y límites

API y verificador compuestos por Bookings; almacenamiento mediante puerto propio y repositorio PostgreSQL, huella SHA-256 del comprador/contexto/pasajeros normalizados (sin PII en claro adicional). Decisiones sucesivas se insertan, no sustituyen la auditoría; vence al embarque y una decisión negativa posterior bloquea. La migración nueva `1794260000000-booking-benefit-reviews` lleva el catálogo a 29 nombres y rechaza down con datos.

La prueba de totales comerciales ahora apunta por nombre a su migración y restaura todas las posteriores en finally. Su prueba de actualización prepara exactamente el prefijo anterior a totales, conserva importes/ocupaciones, revierte su propia migración y reaplica. Se preservan las aserciones originales; no se modifica ninguna migración existente. El catálogo comprueba también la tabla nueva vacía. La prueba de auditoría rechaza down y conserva filas/historial en una base QA propia. Solo la limpieza de la suite comercial incorpora la tabla nueva de pruebas, no se borran acreditaciones productivas.

El operador usa la API con una sesión CLERK real y CSRF; ejemplo de cuerpo (UUID de datos propios, no son credenciales):

```json
{
  "ownerId": "UUID del comprador",
  "tripId": "UUID del viaje publicado",
  "fromPosition": 0,
  "toPosition": 1,
  "seatIds": ["UUID del asiento del bus"],
  "passengers": [{"seatId":"UUID del asiento del bus","identificationNumber":"cédula declarada","fullName":"nombre declarado","birthDate":"1990-01-01"}],
  "decisions": [{"seatId":"UUID del asiento del bus","birthDateVerified":true,"disabilityVerified":false}]
}
```

La respuesta contiene exclusivamente reviewedAt/expiresAt. La misma compra cotiza y reserva por las rutas existentes; cambiar pasajeros/tramo exige nueva revisión. No se incorpora pantalla de oficinista, carga documental ni proveedor de validación externa: es acreditación humana persistida conforme al acuerdo. No habilita emisión sin pago ni cambia descuentos.

## Evidencia final, 4 de noviembre de 2026

Implementada localmente sobre d9ee164; sin commit/publicación ni aprobación de PR. `npm test`: 1929 unitarias y 649 integraciones aprobadas con PostgreSQL 16.13 aislado, 168 suites. Lint, formato propio y diff aprobados; formato global conserva 15 archivos previos ajenos. La prueba HTTP usa el servidor real sin inyectar verificador: CLERK revisa, el cliente cotiza con discapacidad acreditada y crea una reserva; registro de tres decisiones consecutivas, respuesta sin PII, cambio de nombre/tramo y decisión negativa bloquean, otro tenant/rol/CSRF no autorizan revisión. Unitarias prueban el límite exacto de vencimiento y fallo de consulta sin aprobación. Migración/down preservan filas e historial al rechazar pérdida de auditoría. Detalles e intentos intermedios en INTEG-01. No se afirma una pantalla operativa ni validación documental automática.
