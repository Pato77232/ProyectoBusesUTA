# BOOK-CORR-01 — contrato de Reservas para corrección de comprobantes

Responsable de propuesta: Leslie. Consumidor/proveedor de Pagos: Shirley.
Base develop 5b0ecb6. Borrador autorizado por el solicitante, sin conformidad
individual del equipo. RN-50–54. No sustituye PAGOS-CORR-01 ni implementa su UI.

## Diferencia que debe conservar el producto

Rechazo definitivo ya integrado: REJECTED y liberación de asientos.
Solicitud de corrección: conserva la reserva en revisión y sus asientos;
no llamar rejectSale ni volver a PENDING_PAYMENT sin comprobante. La primera
recepción aceptada conserva su fecha, el plazo inicial y proof_reception_state.

## Criterios propuestos para revisión humana

- La edición autónoma dura tres minutos desde la primera carga, como establece
  RN-50–54; no cambia al editar. Aprobación previa bloquea inmediatamente.
- CLERK del tenant solicita una corrección con motivo público obligatorio y
  evento durable correctionRequestId/version, mientras no haya venta/rechazo
  definitivo. Solo una solicitud abierta por comprobante; nueva petición no
  prolonga una ya abierta.
- La ventana solicitada dura 15 minutos desde persisted requestedAt. Server
  calcula correctionExpiresAt; la entrega del correo no inicia ni amplía plazo.
  Se propone máximo una ronda por comprobante en este primer incremento;
  un cambio de ese límite requiere decisión explícita en PAGOS-CORR-01.
- Una entrega dentro de plazo crea versión nueva del comprobante, no otro
  vínculo de reserva. No se confirma venta automáticamente: vuelve a revisión.
  Reservas conserva la recepción inicial y la ocupación, no cobra ni libera.
- Al vencer sin corrección, se cierra la solicitud como vencida y continúa
  revisión manual del comprobante existente. No se rechaza ni se libera
  automáticamente una reserva con recepción aceptada. El oficinista debe
  decidir aprobación o rechazo definitivo justificado.
- No se permiten correcciones después de vender, rechazar definitivamente o
  expirar sin recepción. Aprobación y edición/versionado se serializan; una
  aprobación sobre versión vieja debe fallar, sin aprobar la nueva por error.

## Puertos y datos propuestos

Pagos es dueño de correctionRequestId, paymentProofId, proofVersion,
requestedAt, correctionExpiresAt, estado y motivo público. Actor y cooperativeId
vienen de Auth. El navegador no elige propietario, tenant o timestamps.

Reservas expone por su API pública un contexto mínimo de recepción existente:
bookingId, estado, vínculo exacto de comprobante aceptado, expiración original
como dato histórico y regla de autorización del propietario. No consulta tablas
privadas de Pagos ni altera el archivo del comprobante.

Confirmación de venta debe fijar `(paymentProofId, proofVersion)` aprobado por
Pagos o un identificador inmutable equivalente. El contrato actual solo usa
paymentProofId: evolucionar explícitamente la versión esperada antes de activar
edición. No sobrescribir silenciosamente un vínculo cuyo contenido cambió.

Repetir correctionRequestId/version con mismo contenido recupera resultado;
identidad/contenido diferentes devuelve conflicto. Una notificación de correo
perdida no repite la solicitud ni resetea su plazo. Fallo incierto no habilita
borrar archivos, liberar asientos o declarar rechazo.

## Responsabilidades y secuencia

Leslie: conservación de recepción/ocupación, lectura de propiedad/estado y
compatibilidad de confirmación con versión inmutable. Shirley: solicitud,
versionado de archivo, autorización/CSRF, bloqueo aprobación/edición y pantalla.
Correo consume evento durable de Pagos conforme BOLETOS-02; no se envía desde
Reservas por asumir que un rechazo equivale a corrección.

Antes de implementar: revisar la ronda propuesta, el efecto de vencimiento y
contrato de versión con Shirley; registrar respuestas reales. Migraciones nuevas
para campos/auditoría, sin editar migraciones previas. Se necesita aceptación
conjunta de doble envío, versión vieja, carrera aprobación/edición, tenant,
vencimiento exacto, pérdida de respuesta/correo y protección de datos privados.
No se ejecutan ni crean suites por petición expresa. Esta PR es contractual y
no activa correcciones. Revisión humana pendiente. Preparado con Codex.
