# Revisión del contrato de pagos recibido de Shirley

Fecha: 2 de noviembre de 2026. Responsable de registro: Leslie, con asistencia de Codex.
Estado: revisión documental y propuestas; no autoriza implementación ni acredita aceptación de Leslie de las propuestas nuevas.

## Fuentes y estado comprobable

Leslie adjunta un mensaje y cuatro textos: PAGOS-01, PAGOS-02, PAGOS-CORR-01 y PAGOS-CAJA-01. Shirley reporta rama local feature/PAGOS-02-aprobar-comprobante, HEAD 4e6bbf7, sin publicar y con cambios posteriores sin commit. Los adjuntos son evidencia documental, no un diff ejecutable del commit. No se verificó su rama privada ni se ejecutaron sus pruebas.

PAGOS-01 integrado por PR #23 usa adaptación simulada de Bookings. PAGOS-02 es local según Shirley; corrección/caja son borradores. No copiar estos documentos sobre las specs de otros autores ni presentar su reenvío como nueva aprobación colectiva.

En la rama local de Leslie c7ceed9, bookings/index.js devuelve router; no expone todavía findForPayment, markPaymentProofReceived, confirmSale ni releaseBooking. BOOK-03 local sí tiene tablas/resumen/ocupaciones e idempotencia: las alusiones de los adjuntos a esquema no definido son históricas respecto de esta rama, no prueba de ausencia actual.

## 1. Acreditación

Propuesta expresa de Shirley: verificar antes del total aceptado y pago; una estimación previa puede identificarse como provisional, sin dar por creada una reserva pagable con beneficio no verificado. Pendiente confirmación de Leslie. Pregunta enviada por el canal de aclaración en esta sesión.

Aun si se acepta ese momento, falta definir autoridad verificadora, evidencias, asociación al pasajero y revisión auditable/privada. No suponer que un oficio/revisión existe antes de la compra porque PAGOS-02 revise comprobantes después. No consulta externa simulada ni acreditación por validación estructural de cédula.

Confirmado previamente por Leslie: mayor beneficio sin acumular; categorías empatadas conservadas. No confundir cálculo con acreditación.

## 2. Identidad y concurrencia de versiones

Shirley propone paymentProofId estable y un ID distinto por versión; revisión/intención vinculadas a versión examinada. Prohibir reemplazo mientras aprobación está pendiente/incierta hasta recuperar resultado. Son propuestas pendientes, no código implementado.

Antes de ampliar confirmSale cerrar el protocolo: cómo Bookings recibe/valida vínculo de versión y cómo Payments impide cambio tras iniciar aprobación. Una lectura aislada de versión seguida de llamada no evita la carrera. Recuperar mismo resultado por operación estable; cambiar versión/datos no equivale al mismo intento.

No reiniciar plazo inicial ni tratar reemplazo como nueva recepción inicial. La primera recepción aceptada debe seguir siendo recuperable aun después del plazo.

## 3. API autorizada — propuesta de contrato a completar

Firmas actuales reportadas por Shirley: findForPayment(bookingId), markPaymentProofReceived({ bookingId, cooperativeId, paymentProofId }) y confirmSale({ bookingId, cooperativeId, paymentProofId }). Los adjuntos atribuyen aceptación histórica al 29 de octubre; registrar esa atribución como fuente de Shirley, sin usarla para aprobar unilateralmente ampliaciones de versión/contexto.

Propuesta de evolución, no funciones disponibles:

| Operación | Datos/contexto que deben cerrarse | Resultado mínimo por acordar |
| --- | --- | --- |
| findForPayment | bookingId, propósito y principal/contexto verificado del servidor: comprador o CLERK de cooperativa | DTO mínimo autorizado: bookingId, propietario mínimo, cooperativeId, estado, expiresAt, totalPriceCents, currency USD y admisión de carga; ausencia/ajena indistinguibles para consumidor no autorizado |
| markPaymentProofReceived | bookingId, cooperativeId, paymentProofId, identidad/versionado inicial acordados y contexto de servicio autorizado | recepción aceptada/repetida o rechazo definitivo; fallo técnico/timeout incierto nunca compensación automática |
| confirmSale | vínculos anteriores, versión revisada y referencia estable de intención/validación, contexto autorizado | venta confirmada o repetición idéntica; rechazo definitivo; error incierto recuperable |
| releaseBooking | vínculo/operación estable, motivo, justificación y actor/contexto autorizado | liberada o repetición; conflicto si vendida; fallo incierto recuperable |

No fijar nombres finales de campos de versión/intención ni cambiar puertos unilateralmente. cooperativeId y un rol enviados en JSON no constituyen por sí solos autoridad. Propuesta: la composición entrega un contexto verificado a la aplicación; la API pública comprueba propietario/tenant y propósito. Sin cliente pg, repositorios ni escritura directa de Payments.

Propietario no necesita estar en todos los DTO si no lo requiere el propósito; minimizar datos personales. Para lectura por comprador no derivar tenant del token CUSTOMER (es nulo); derivarlo de reserva después de validar propiedad. Para CLERK comparar tenant autenticado con reserva/comprobante.

## 4. Recepción y expiración

Conservadas las reglas ya documentadas: archivo persistido no es recepción aceptada; Bookings serializa con expiración. Aceptación antes del límite conserva asientos en revisión; repetición de aceptación devuelve resultado previo después del límite; expiración ganadora impide venta. Timeout conserva archivo/outbox.

Pruebas conjuntas: límite exacto, ambas órdenes de carrera, respuesta perdida después de COMMIT, reinicio y reintento. Una reserva sin recepción aceptada no se protege solo por un aviso pendiente que aún no conoce Bookings.

## 5. Importe validado e intención

Shirley propone persistir importe observado en centavos, versión, actor y resultado de revisión antes de confirmar. Bookings es autoridad del total esperado; Payments/oficinista de lo observado y revisado. Recomendación: validar coincidencia de USD/importe esperado y observado, autorización y vínculo/revisión antes de vender, conservando una intención durable.

Si no coincide, propuesta para acordar: no confirmar ni modificar silenciosamente total; dejar pendiente de resolución del oficinista. No autoriza cobro adicional, devolución automática o cambio de precio aceptado. Definir qué datos de validación llegan por API y la identidad idempotente, sin confiar en un precio final del navegador. La aprobación final de Payments solo después de venta confirmada; fallo local posterior se recupera desde intención y resultado de Bookings.

## 6. Correcciones — reconciliación con PR #35

Los 3 minutos desde primera carga, aprobación que bloquea reemplazo y 15 minutos tras solicitud del oficinista ya constan confirmados en acuerdos-primera-entrega.md §6. PAGOS-CORR-01 debe dejar de presentarlos globalmente como simples propuestas. Permanecen pendientes el instante técnico, consecuencia de vencimiento, rondas y correo.

Propuestas de Shirley, aún no aceptadas por Leslie:
- Primera carga: falta precisar evento durable exacto; propuesta para discutir: timestamp de primera persistencia válida del archivo/comprobante en servidor, no selección de archivo ni respuesta del navegador. No confundir con aceptación inicial de Bookings.
- Quince minutos desde persistir solicitud, no desde recibir correo.
- Vencimiento cierra edición y mantiene revisión/asientos; sin rechazo/liberación automáticos.
- Límite de rondas y simultaneidad sin respuesta definida; recomendar una solicitud activa por comprobante, sin inventar un máximo numérico.
- Correo tardío/fallido: no afirmar entrega; política de reapertura o conservación del vencimiento por cerrar. Envío durable/reintentable no equivale a recepción.

No implementar consecuencia de 15 minutos mientras no exista acuerdo humano. Cualquier nueva ronda debe auditarse y no reiniciar el plazo inicial de recepción.

## 7. Venta, rechazo y recuperación

Mantener idempotencia de venta, intención durable con actor original y rechazo definitivo justificado. Venta confirmada nunca se libera. Aprobación/rechazo deben tener exclusión mutua compartida y recuperar decisión previa tras respuesta perdida.

Falta cerrar clave/versionado de releaseBooking, resultado persistido, reintento y registro final de Payments. No copiar la confirmación de depósito para efectivo con un paymentProofId ficticio.

## 8. Efectivo e invitado

PR #35 confirma reutilizar reserva/cotización y venta presencial por oficinista sin archivo de depósito; PAGOS-CAJA-01 debe conciliar esa base, sin reabrirla como si toda venta en efectivo estuviera sin decidir. Siguen pendientes plazo de caja, abandono, cancelación autorizada, registro de cobro, recuperación e identidad de operación distinta del comprobante.

No aplicar automáticamente los 180–300 segundos de recepción de archivo a efectivo. La caja requiere intención/medio propios e idempotencia, sin inventar un comprobante. Invitado depende de contrato Auth/Pablo; UUID o cédula no autorizan acceso.

## Incrementos y evidencia

1. Confirmar momento de acreditación y especificar proveedor/revisión; completar BOOK-05-L01.
2. Acordar lectura autorizada y recepción inicial con ejemplos/resultados; actualizar BOOK-07-L05 y BOOK-06-L04 antes de código.
3. Versionado y aprobación/rechazo con intención durable y carreras reales, en tareas separadas.
4. Correcciones/caja/invitado con sus decisiones pendientes y specs específicas.

Solo se leyó documentación y API local y se actualizan notas propias. No implementación, migraciones, dependencias, pruebas nuevas, commits ni publicación. Las pruebas de Shirley son resultados reportados de su entorno, no resultados ejecutados aquí. La revisión humana de contratos/código e integración productiva permanecen pendientes.
### Acreditación: confirmación de Leslie, 2 de noviembre de 2026

Respuesta humana en este chat: «Sí, verificar antes del total aceptado». Se acepta la propuesta de Shirley de acreditar antes de que el comprador acepte el total y pague. Una estimación anterior no equivale a resumen final aceptado ni autoriza pago con beneficio sin verificar. Esta confirmación reemplaza el pendiente sobre el momento de acreditación; siguen pendientes autoridad verificadora, evidencia, registro y acceso privado. No autoriza una integración ficticia ni acredita implementación. Los demás acuerdos de versiones, correcciones y efectivo propuestos siguen pendientes.
