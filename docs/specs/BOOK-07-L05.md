# BOOK-07 / L-05: APIs públicas para pagos y hojas

## Coordinación con David para D-05 — 3 de noviembre de 2026

Fuente: respuesta de Leslie aportada por David al autorizar la sección 0 de [ROUTE-SHEETS-08](ROUTE-SHEETS-08.md). Leslie confirma que todavía no expone una API pública con detalle de ocupaciones para sustitución y que los booleanos históricos de §5 no bastan para identificar afectados. Propone consulta autorizada por viaje con bookingId, seatId, estado y posiciones inicio/fin, incluyendo RESERVED/SOLD efectivos y reservas con comprobante en revisión, sin datos personales innecesarios. Nombre/firma definitiva, permisos y revisión de lectura pendientes; no hay commit disponible de esta API según su mensaje.

Leslie señala que su bloqueo interno por cooperativa/viaje no coordina por sí solo la sustitución entre módulos. Debe acordarse protocolo común, orden de bloqueos, revalidación y rollback; no compartir repositorios ni permitir escrituras directas entre módulos. Se conservan motivo, autor, buses anterior/nuevo y correspondencia explícita entre seatId; versión de inventario/compatibilidad por cerrar con Edwin. Sin correspondencia válida para todos los compromisos, se bloquea la sustitución automática.

Autorización de reubicación manual, comunicación al pasajero y registro siguen pendientes de acuerdo operativo. Cualquier cambio de importe se revisará con Shirley; no se recalculan automáticamente compras anteriores. Leslie permite continuar preparando renovación preservando viajes/reservas, con sustitución en spec e incremento separados. Este registro no implementa ni autoriza código de Bookings, no sustituye sus contratos vigentes de Pagos y no atribuye respuestas nuevas a Edwin/Shirley.

> Contrato de destino actualizado el 2 de noviembre: aplicar el diseño publicado en PR #46, contrastado con el adaptador integrado de PR #47. Ver [conciliación actual](../reservas-pagos-conciliacion-20261102.md). Firma/contexto/errores ya seleccionados según delegación reportada; falta especificar e implementar persistencia y proveedor con pruebas. El lector reducido anterior queda superado.

- **Planificación:** L-05; no es una spec aprobada ni un ID externo.
- **Spec existente:** [BOOK-07](BOOK-07.md).
- **Responsable:** Leslie Coello.
- **Revisor propuesto:** Pablo, conforme a la preferencia previa de Leslie; aceptación de este incremento pendiente. Coordinar contratos con los responsables indicados.
- **Estado:** Borrador; implementación de los nuevos incrementos no autorizada.
- **Base:** rama `feature/BOOK-03-resumen-creacion-dominio`, `c7ceed9`; remoto `origin/develop b60201e`, consultado el 1 de noviembre de 2026, sin integrar.
- **Autorización:** el usuario pidió preparar specs antes de implementar; no se infiere aprobación de este borrador.
- **Referencias:** [plan y evidencia](../reservas-plan-primera-entrega.md), [acuerdos vigentes](https://github.com/Pato77232/ProyectoBusesUTA/blob/b60201e/docs/acuerdos-primera-entrega.md), arquitectura y calidad del proyecto.

## 1. Objetivo

Exponer operaciones y consultas autorizadas desde bookings/index.js usando persistencia real, sin entregar repositorios ni acceso directo a tablas.

## 2. Reglas

RN-02/40/50–54. RESERVED/SOLD efectivos cuentan, incluida revisión. Payments es autoridad del comprobante/revisión; Bookings de reserva, precio esperado y ocupaciones.

## 3. Alcance

Separar consultas de ocupaciones para David de lectura/recepción/venta/liberación para Shirley. No duplicar Payments ni implementar emisión de boletos en Reservas.

## 4. Flujo

Validar contrato/contexto confiable → resolver reserva/asignación/cooperativa desde fuentes de servidor → consultar o ejecutar transacción → resultado explícito. Error del proveedor nunca se convierte en ausencia de pasajeros.

## 5. Contratos existentes y propuestas

**Aceptado según reporte de David**, ROUTE-SHEETS-02 §5.2, integrado en PR #33; no es confirmación individual nueva obtenida en esta sesión:

- bookingQueries.hasPassengersForBusOnRouteSheet(routeSheetId, busId, cooperativeId): boolean.
- bookingQueries.hasPassengersForAssignment(assignmentId, cooperativeId): boolean.
- RESERVED/SOLD efectivos; filtro de cooperativa; false solo ante lectura exitosa sin ocupaciones. Ausencia del proveedor falla cerrado; conservar errores.

Esas consultas son booleanas, no autorización para entregar listas/cédulas de pasajeros. Necesitan relación persistida de L-03. El adaptador de David ya existe: no reimplementarlo en route-sheets.

**Contratos para lectura, recepción y venta acordados con Shirley el 4 de noviembre de 2026; implementación pendiente:**

| Operación propuesta | Entrada por precisar | Resultado y autoridad |
| --- | --- | --- |
| findForPayment | bookingId y contexto autorizado de propietario/tenant | Reserva, total esperado en centavos, estado/plazo y vínculo de comprobante mínimo; no consulta pública por UUID |
| markPaymentProofReceived | bookingId, cooperativeId, paymentProofId/versionado y contexto confiable | Recepción durable idempotente; aceptada, rechazo definitivo o incierto/reintentable |
| confirmSale | bookingId, cooperativeId, paymentProofId y contexto autorizado | Confirmada o recuperada por la misma identidad y versión; rechazo definitivo o resultado incierto |
| releaseBooking | Identidades, motivo/justificación y contexto autorizado | Liberación idempotente elegible; nunca venta confirmada |

Las firmas de Payments que hoy reciben solo bookingId no se amplían silenciosamente. Acordar compatibilidad con Shirley. Un cooperativeId sin contexto verificable no acredita permiso. No exponer clientes pg, repositorios ni operaciones SQL a consumidores.

## 6. Endpoints

API interna de módulos por index.js, sin endpoint público de aprobación en Bookings. HTTP de Payments conserva autorización CLERK/tenant y CSRF según su spec.

## 7. Criterios de aceptación pendientes

- [ ] Consultas de David responden booleano real y aíslan cooperativas, hoja/bus/asignación.
- [ ] Fallos técnicos se propagan; nunca false de sustitución.
- [ ] Lectura para pago impide acceso de otro comprador/cooperativa.
- [ ] Confirmar dos veces con el mismo `paymentProofId`, `proofVersion` y vínculos devuelve la venta previa sin duplicar efectos.
- [ ] Reutilizar comprobante en otra reserva/cooperativa o vender con otro comprobante da rechazo.
- [ ] Venta y expiración se coordinan; venta confirmada no se libera.
- [ ] Timeout permite reintento con el mismo `paymentProofId` y `proofVersion`, sin marcar comprobante aprobado ni borrar evidencia como si fuese rechazo definitivo.

## 8. Casos borde

Comprobante guardado con aviso pendiente, reemplazo/versiones durante revisión, importe observado diferente, autorización vencida, respuesta perdida tras commit y reserva ya confirmada después de su plazo inicial.

## 9. Pruebas previstas

Contrato real con consumidor de David; PostgreSQL para RESERVED/SOLD/revisión y tenant cruzado. Con Shirley: lectura autorizada, identidad de comprobante, duplicados, reutilización, timeout/reintento, rechazo justificado, protección de ventas y carreras de L-04. Acordar qué módulo compara importe comprobado contra esperado: recalcular total esperado no prueba transferencia real.

## 10. Decisiones necesarias

Leslie y Shirley acordaron el 4 de noviembre de 2026 las firmas de los tres identificadores, la consulta pública de intención con vínculos, versión, oficinista y fecha, el bloqueo transaccional durante intención pendiente o incierta, y los resultados tipados de confirmación. Sigue pendiente definir cómo tratar comprobantes preexistentes antes de asignarles versiones. También quedan por implementar y probar las APIs y transacciones reales, la autorización previa, el registro durable del aprobador, el importe efectivamente validado y la emisión reintentable. La recepción aceptada en plazo permite aprobar después; confirmSale no debe rechazar solo por expiresAt pasado en revisión. Recuperar venta idempotente previa antes de validar estado transitorio de nuevo.

Leslie/David: referencias reales de L-03 para consultas; mantener las firmas ya documentadas. Acordar protección concurrente de modificaciones de hoja ante nuevas reservas: una lectura booleana aislada no cierra esa carrera por sí sola.

## 11. Defecto inducido

No aplica. No introducir ni corregir incidentalmente defectos académicos; seguir errores-inducidos.md.

## 12. Diseño y usabilidad

Puertos pequeños y DTO mínimos; aplicación sin pg/Express ni internals de otros módulos. Composición explícita evita ciclo entre catálogo de hojas y consultas de reservas. Sin interfaz nueva aquí.

## 13. Incrementos y archivos previstos

1. Consulta pública de ocupaciones reales: repositorio/caso de uso/index.js, pruebas PostgreSQL y composición con David.
2. Lectura autorizada y recepción coordinada con L-04: contratos y persistencia real.
3. Venta y liberación: transacciones/idempotencia y contrato con Payments; casos de uso separados.

Los incrementos 2/3 requieren confirmación de Shirley antes de implementar. Lint, format:check y npm test desde backend con base aislada; arranque real cuando se conecten módulos.
## 14. Revisión y cierre

Revisión humana, autorización de incremento e integración pendientes. Ningún criterio futuro se marca aprobado por la existencia de este borrador. Evidencia documental de esta sesión en el plan; resultados de producto pendientes.
### Adjuntos de Shirley recibidos — 2 de noviembre de 2026

Se revisaron mensaje y PAGOS-01/02/CORR-01/CAJA-01 recibidos de Leslie. [Conciliación y propuestas pendientes](../reservas-contrato-pagos-revision.md). La rama de Shirley y sus cambios posteriores a 4e6bbf7 son locales según su reporte; no se verificó código ni se repitieron pruebas. No presentar versiones, contexto autorizado o APIs de Bookings como implementados. Acreditación previa al total aceptado y consecuencias de corrección son propuestas pendientes de respuesta humana; las ventanas 3/15 minutos y efectivo sin archivo ya constan en PR #35. No autoriza implementación.
## Versión compartida con Shirley — 2 de noviembre de 2026

Shirley solicita estos archivos completos porque los borradores posteriores a c7ceed9 no están publicados. Mensaje recibido por Leslie en este chat; no prueba acceso a la rama privada de Shirley ni aprobación del código.

Confirmación actual que corrige el pendiente histórico anterior: Leslie confirmó y Shirley reconoce acreditar antes del total aceptado y pago. Quién verifica, documentos, registro y acceso privado siguen pendientes. Se conservan las reglas ya documentadas de recepción–expiración, venta idempotente y rechazo justificado; su API productiva sigue sin implementar.

Shirley propone cerrar primero findForPayment: entradas, propósito/contexto autorizado, DTO y errores; después recepción, confirmación y liberación con resultados/reintentos. Registrar ese orden como propuesta de conciliación, no como autorización de implementación ni contrato final aceptado.

Pendientes expresos conservados: protocolo de versiones/bloqueo durante aprobación pendiente o incierta; validación del importe y diferencias; eventos técnicos de inicio, máximo de solicitudes, correo y consecuencia de vencer corrección; plazo/abandono/cancelación de caja; invitado con Auth. Los plazos 3/15 minutos constan en PR #35, pero no se deduce de ellos una consecuencia de vencimiento. La propuesta de cerrar edición y mantener revisión/asientos al vencer 15 minutos no está aprobada por Leslie.

Esta versión incluye los cambios locales posteriores a c7ceed9. No es archivo obtenido de ese commit ni nueva spec aprobada. Preparación documental para envío manual por Leslie, sin mensaje externo enviado por herramientas, sin código, pruebas funcionales, commits o publicación.
## Propuesta concreta del primer lector — 2 de noviembre de 2026

Leslie autoriza preparar el contrato mientras Shirley responde. [findForPayment: propuesta completa](../reservas-find-for-payment-propuesta.md) especifica firma propuesta de consulta/propósito más contexto verificado, dos permisos (CUSTOMER dueño para carga inicial; CLERK de la cooperativa para revisión), DTO mínimo, null indistinguible para ausente/ajena y errores. Veinte escenarios previstos cubren acceso, límite exacto, cambios de configuración, privacidad, fallo de base y ausencia de efectos.

Es cambio explícito frente a findForPayment(bookingId), no firma implementada ni aceptada por Shirley. API local sigue devolviendo router. No se agregan permisos de invitado, administrador, caja o trabajador de fondo. La lectura no expira, libera, aprueba ni prolonga; canUploadProof es informativo, sujeto a revisión en recepción. Estados futuros y datos de recepción deben definirse antes de habilitar esa respuesta; no se inventan en el lector.

Próxima decisión con Shirley: aprobar firma/contexto, propósitos, necesidad de ownerId y otros campos, null/errores, estados soportados y adaptación del puerto. Ninguna respuesta pendiente se considera aprobación por silencio. Preparación exclusivamente documental; no código, migraciones ni pruebas funcionales ejecutadas.
## Conciliación de Shirley y propuesta de alcance base — 2 de noviembre de 2026

Se leen sus dos contratos adjuntos; la versión consolidada retoma firma de dos argumentos, REVIEW_PAYMENT, IDs opacos, ISO UTC y clasificación separada de errores. [Revisión vigente de alcance, §12](../reservas-find-for-payment-propuesta.md#12-conciliación-posterior-con-shirley--alcance-base-propuesto-2-de-noviembre-de-2026): ownerId solo para UPLOAD_PROOF; createdAt/fecha límite proceden del mismo instante de aplicación en el flujo local, con validación de precisión y duración sin redondeo.

Brecha reconocida: sin vínculo persistido no se puede comprobar ausencia de recepción. Propuesta concreta pendiente de Shirley: primer DTO de lectura base sin canUploadProof ni acceptedPaymentProof; no sustituirlos por false/null ni habilitar integración productiva de carga. Elegibilidad y F11 después del incremento persistido L-04/L-05. No atribuir aceptación por preparar esta corrección ni afirmar cerrado el contrato mientras falten contexto/errores con Pablo y confirmación de alcance. Sin implementación/migración/commit.
## Primer incremento preparado — 2 de noviembre de 2026

[BOOK-07-L05-T1](BOOK-07-L05-T1.md) concreta la persistencia y el lector conforme a PR #46: inicio y duración explícitos, conocimiento UNKNOWN/NOT_RECEIVED/RECEIVED sin inventar historia, creación atómica, autorización/DTO/errores y 18 grupos de aceptación previstos. Borrador técnico preparado; implementación no iniciada. Pasos A–C pendientes de autorización de esta spec; no otra aceptación genérica de firma/contexto. Viajes ya integrados mediante PR #49, sin conexión automática a la rama local ni ampliación del alcance.
## Implementación local del lector A–C — 2 de noviembre de 2026

[BOOK-07-L05-T1](BOOK-07-L05-T1.md) autorizado por Leslie e implementado localmente. Persistencia contractual nueva y paymentQueries.findForPayment con lectura PostgreSQL real, identidad/tenant, DTO de PR #46, códigos seguros e historia UNKNOWN. 1045 pruebas backend finales aprobadas (839 unitarias/206 integración), incluido arranque; nueve comprobaciones contra consumidor real PR #47. Formato propio aprobado, global fallido en 24 archivos ajenos. [Uso/límites/evidencia](../reservas-lector-pagos.md). Sin commit/PR/integración ni rutas de Payments conectadas; recepción/venta/liberación siguen fuera de este incremento y revisión humana pendiente. Las secciones de propuesta anteriores son históricas respecto a este resultado.

## Acuerdo de versionado e intención de aprobación — 4 de noviembre de 2026

Leslie confirmó la propuesta de Shirley para implementar BOOK-07 `confirmSale` sin cambiar su firma `({ bookingId, cooperativeId, paymentProofId })`:

- Payments mantiene `proofVersion` entero: inicia en 1 para comprobantes nuevos y aumenta al completarse cada reemplazo.
- Al registrar la intención, Payments bloquea el comprobante y persiste versión, oficinista y fecha en una transacción. El bloqueo permanece mientras la confirmación sea incierta.
- Payments expone una consulta pública de intención con los tres identificadores; responde vínculos, `proofVersion`, oficinista y fecha. La versión debe identificar el contenido bloqueado. Su nombre concreto se define al implementar la API/composición; Bookings no consulta tablas directamente.
- Bookings guarda la versión con la venta. Reintentos con la misma identidad y versión recuperan el resultado persistido; una versión distinta no es el mismo intento.
- El adaptador traduce venta persistida a `true`, rechazo definitivo a `BookingSaleRejectedError` e incertidumbre a `BookingSaleUncertainError`; `false` no expresa rechazo definitivo.
- El tratamiento de comprobantes existentes antes de asignarles versiones no está decidido; no se les asignarán versiones automáticamente hasta documentarlo.

Este acuerdo define el contrato, no acredita implementación. La consulta y confirmación públicas, persistencia versionada, bloqueo concurrente y pruebas entre módulos siguen pendientes.
