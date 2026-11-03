# Reservas y Pagos: conciliación tras PR #46 y #47

Fecha: 2 de noviembre de 2026. Responsable de registro: Leslie, con asistencia de Codex.
Estado: contrato del lector publicado contrastado; alcance de implementación y demás propuestas separados. No código nuevo en esta sesión.

## Base verificada y reemplazo de propuestas

GitHub confirma PR #46 integrada en e414f7a y PR #47 integrada en 975e2a1. Fetch sitúa origin/develop en 1dcbd6d; la rama local de Leslie sigue feature/BOOK-03-resumen-creacion-dominio en c7ceed9, con documentación sin commit. No se incorporó ese develop ni se afirma haber probado la combinación.

Fuente vigente del lector: [contrato publicado](https://github.com/Pato77232/ProyectoBusesUTA/blob/e414f7ad4bcc35a4bd208abc468867d91ee84200/docs/contratos/lectura-reservas-pagos.md), especialmente §§1–4. Su decisión por delegación reportada se conserva con esa atribución; no es una verificación individual del esquema ni aprobación de código de Leslie.

La propuesta local anterior de un DTO reducido sin canUploadProof queda superada para compatibilidad con ese contrato. También queda superado derivar el inicio contractual exclusivamente de createdAt. La igualdad en el flujo actual es evidencia de ese flujo, no permiso para completar todos los registros históricos por suposición.

## 1. Lector, datos y registros anteriores

Firma vigente de diseño: bookings.paymentQueries.findForPayment({ bookingId, purpose }, authContext). UPLOAD_PROOF/REVIEW_PAYMENT; texto opaco no vacío, sin sobrecarga antigua.

DTO vigente: bookingId, cooperativeId, status, totalPriceCents, currency, createdAt, proofWindowStartedAt, proofWindowSeconds, expiresAt, evaluatedAt, canUploadProof. ownerId solo para UPLOAD_PROOF. Fechas ISO UTC, moneda USD y total persistido; lectura sin efectos.

Siguiente incremento propuesto: especificar y añadir persistencia explícita de inicio, duración y conocimiento/resultado de recepción mediante migración nueva; adaptar creación y lector después de autorización. No editar migraciones previas ni registrar recibos en nombre de Payments.

Historia: conservar registros existentes; no default null interpretado como “no recibió comprobante”. Si falta evidencia para inicio/duración/recepción, mantener estado desconocido y responder BOOKING_DATA_INTEGRITY_ERROR al intentar servir ese contrato, no canUploadProof true o false como sustitución. Conciliación controlada por registro, auditable y con evidencia de origen, en tarea propia; no consultar tablas privadas de Payments desde Bookings.

Nuevas reservas bajo el contrato nuevo deben capturar inicio, duración, vencimiento y ausencia explícita/conocida de recepción en la misma transacción de creación. Esa información podrá cambiar solo por la operación autorizada de recepción, no por lectura ni reemplazo de archivo. Modelo físico de desconocido/conocido por fijar en la spec de persistencia; no inferirlo de PENDING_PAYMENT.

## 2. Contexto y errores

Diseño publicado: contexto mínimo { userId, role, cooperativeId }, proyectado por frontera HTTP de solicitud previamente verificada por Auth. No sid/token/req/res, no objetos del body como credencial. Autenticación por solicitud; trabajador durable requiere contrato separado.

Mantener UNAUTHENTICATED, FORBIDDEN, BOOKING_VALIDATION_ERROR, BOOKING_DATA_INTEGRITY_ERROR, BOOKING_QUERY_UNAVAILABLE e INTERNAL_ERROR. Null uniforme para inexistente/ajena; en bandeja una relación inexistente esperada es integridad 500. El adaptador integrado de Shirley selecciona esos códigos; no volver a tratarlos como preguntas genéricas pendientes de elegir. Traducción de proveedor/consumidor se comprueba en pruebas reales.

## 3. Recepción y expiración

Reglas conservadas: aceptación de recepción por Bookings, no guardado de archivo, determina elegibilidad. Reloj confiable evaluado tras adquirir bloqueo común; ahora < expiresAt permite recepción elegible, igualdad o después rechaza nueva recepción. Recuperación de operación previamente aceptada se consulta antes de rechazar por plazo transcurrido.

Propuesta de contrato de escritura a concretar con Shirley: contexto autorizado de operación, vínculo bookingId/cooperativeId/paymentProofId, identidad/versionado y clave estable; persistir vínculo/instante/resultado en la misma transacción que protege todas las ocupaciones frente a expiración. Respuesta aceptada previa debe sobrevivir reinicio y pérdida de respuesta. Error incierto conserva comprobante y aviso; rechazo definitivo se distingue explícitamente.

Firma exacta ampliada y credencial de trabajador no implementadas ni aprobadas por leer PR #46. Conservar tres identificadores de los puertos actuales como antecedente, sin afirmar que su firma es suficiente para nuevo versionado. Un único orden de bloqueo compatible con creación/venta/liberación se fija antes de implementar carreras.

## 4. Identidad y versiones

Propuesta de Shirley conservada pendiente: paymentProofId estable por vínculo, ID separado por versión, revisión/intención sobre versión exacta y bloqueo de reemplazos mientras aprobación está pendiente/incierta. Evidencia anterior conservada. Payments es dueño de archivos/versiones; Bookings de recepción/ocupación/venta.

Antes de código: definir cómo el contexto de validación confiable acredita versión vigente y cómo Payments congela esa versión durante la intención. Un chequeo aislado anterior a confirmSale no cierra la carrera. No reutilizar una operación con otros vínculos o versión.

## 5. Importe y acreditación

Confirmado: total aceptado/congelado pertenece a Bookings; acreditación antes de ese total/pago. Pendientes: quién verifica, documentos, registro y acceso privado.

Propuesta de validación de pago a acordar: intención durable con actor, versión revisada, moneda e importe observado; no confirmar si no coincide con el esperado. Diferencia conserva expediente pendiente para resolución humana, sin recotizar, cobrar diferencia o devolver automáticamente. Señalar aún propuesta donde corresponda; PR #47 no implementa registro completo de importe observado/versionado.

## 6. Corrección: nueva confirmación expresa

**Acordado por Leslie en este chat, 2 de noviembre:** «Sí, cerrar edición y mantener revisión». Al vencer los 15 minutos se cierra la edición; reserva y asientos permanecen en revisión. No rechazo ni liberación automáticos.

Esta confirmación responde a la propuesta expresa de Shirley reenviada por Leslie. No acredita implementación ni fija por sí misma las otras decisiones: evento técnico de primera carga/solicitud, límite exacto, máximo de rondas, concurrencia con aprobación/rechazo, ni correo tardío/fallido. Los 3/15 minutos ya estaban confirmados en PR #35. Las notas locales que presentaban pendiente esta consecuencia son históricas y quedan reemplazadas solo en ese punto.

Propuestas aún pendientes: ventanas semiabiertas (ahora < fin); 15 minutos desde persistencia de solicitud; una solicitud activa a la vez; límites de rondas y actuación ante correo fallido por acordar con Shirley/Pablo. No inventar máximo numérico ni extender plazos por fallo de correo.

## 7. Confirmación de venta

Reglas confirmadas: idempotencia, venta previa recuperable por misma identidad/vínculos, aprobación final de Payments únicamente después de confirmación de Bookings, conservación de actor original de intención y no liberación de venta confirmada.

Pendiente contrato exacto ampliado de confirmSale para versión/importe/actor/contexto de operación, resultados persistidos y recuperación. Propuesta de resultados: confirmado/repetido, rechazo definitivo o incierto; códigos/campos definitivos se fijan antes de implementación. Si recepción fue aceptada a tiempo, no rechazar solo por vencimiento del plazo inicial durante revisión.

## 8. Rechazo y liberación

Reglas confirmadas: justificación obligatoria y operación autorizada; venta confirmada no se libera; competir transaccionalmente con venta.

Propuesta a acordar: no iniciar rechazo/liberación con aprobación de resultado incierto; recuperar primero esa intención hasta conocer el resultado. Una operación estable de liberación recupera su resultado tras timeout. Actor/tenant/contexto, motivo y estados elegibles por fijar en la spec separada; no liberar por tratar un timeout como rechazo.

## 9. Caja

Confirmado: reutilizar reserva, sin archivo de depósito. No aplicar automáticamente plazo de carga ni fabricar paymentProofId para efectivo.

Pendientes con Leslie/Shirley: plazo específico, comprador/pasajeros, intención de cobro con actor/importe/medio, abandono/cancelación y resultado incierto. Proponer flujo separado de confirmación con identidad de operación de efectivo, no reutilización ciega del contrato de comprobante. No hay decisión humana nueva sobre esos valores en esta sesión.

## 10. Invitado y correo

Pablo/Auth acredita acceso limitado a compra; faltan relación compra–reserva y contexto autorizado. No equivaler compra a bookingId sin acuerdo ni inventar CUSTOMER.

Relación propuesta para discutir: compra tiene propietario/acceso, una o más reservas con tenant propio, y permisos limitados a los vínculos realmente persistidos. Cardinalidad aún por confirmar; no crear esquema de compra aquí.

Eventos propuestos: solicitud de corrección y venta confirmada que da lugar a emisión de boletos; aviso durable identificado, estados pendiente/aceptado por proveedor/entrega acreditada/fallo. Propietarios: Pablo puerto/proveedor de correo y acceso; Shirley avisos/revisión/boletos; Leslie estado de reserva y vínculo. Fallo de correo/emisión no revierte venta ni repite cobro. Los contratos detallados siguen separados.

## 11. Publicación, orden y fechas

Implementado localmente en Leslie: dominio, creación/persistencia idempotente y API/pantalla históricas con proveedores faltantes; no lector público de pagos, recepción, venta o liberación productivos. En remoto: PR #47 aporta consumidor nuevo preparado, pero continúa fuera de las rutas con proveedor real.

Orden propuesto de trabajo: persistencia contractual + lector → recepción/expiración → venta/rechazo → corrección/caja; revisión y pruebas por incremento. No comenzar todo como una única tarea.

Objetivos de planificación propuestos, no fechas comprometidas ni cierre prometido:
- 2 de noviembre: terminar spec de persistencia/lector y autorizar primer incremento; comenzar implementación si se autoriza y entorno/dependencias están resueltos.
- 3 de noviembre: priorizar integración lector/recepción y carreras, luego confirmación/liberación, según contratos y resultados reales.
- Antes de presentar el 4: ejecutar flujo integrado y reportar alcance real. Si no se completa, declarar límites; no presentar simulación como integración.

No hay PR de Leslie para este proveedor ni publicación permitida por la instrucción actual. Hacer accesible la rama exige una acción de publicación autorizada por Leslie; no inventar URL ni ejecutar push/commit. Preparar evidencia/archivos revisables y mantener los borradores compartidos identificados. No afirmar que se integrará en una fecha sin pruebas y revisión humana.

## Evidencia de esta conciliación

Se leyó el mensaje adjunto, contrato público PR #46 y adaptador de PR #47; ambas merged verificadas con GitHub y fetch. No se ejecutaron suites de las PR ni pruebas del proveedor nuevo. Cambio solo documental; sin dependencias, migraciones, código, commits, publicación o integración local. Confirmación de consecuencia de corrección registrada como respuesta humana real; otras propuestas conservan su estado.
