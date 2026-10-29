# BOOK-03 T3: aceptar el resumen y crear una reserva por caso de uso

- Responsable: Leslie Coello. Revisor propuesto: PabloToapanta.
- Fecha: 29 de octubre de 2026. Spec previa al código, autorizada por Leslie al iniciar el plan de entregas funcionales.
- Rama existente: feature/BOOK-03-resumen-creacion-dominio. Un PR final hacia develop con T1/T2/T3/T4; no publicar un PR por cada commit.
- Base local e96a277; origin/develop consultado en e556e59. Sus cambios de infraestructura/frontend y reversión de migraciones aún no están incorporados a esta rama. APIs públicas revisadas: flota ofrece grupos, no plantillas de buses; no existe catálogo de viajes fechados comercializables. No inventar esos datos.

## Resultado y tareas pequeñas

A. Caso de uso getBookingSummary, contexto confiable de compra y revisión del resumen.
B. Caso de uso createBooking que usa el repositorio transaccional existente y vuelve a calcular el resumen después del bloqueo.
Cada parte incluye sus pruebas y commit; ambas pertenecen a la misma funcionalidad de creación, todavía sin publicar.

## Contratos internos

- Entrada del resumen: los cinco campos de createBookingSummary, copiados antes de cualquier espera asíncrona. Rechazar campos adicionales.
- Contexto de llamada separado: authContext entregado por autenticación, nunca por el body. buyerIdentity.resolve(authContext) verifica la identidad y devuelve {ownerId} no vacío o rechaza; no se presupone proveedor implementado ni se confía directamente en userId del navegador.
- tripCatalog.findBookableById: contrato de T2, null significa no comercializable. El caso de uso obtiene la cooperativa exclusivamente del catálogo, nunca de la entrada del comprador.
- passengerVerifier.verify({ownerId, passengers, departureDate}): una entrada por asiento {seatId, birthDateVerified, disabilityVerified}, booleanos explícitos. Se requiere birthDateVerified true para aplicar reducción por edad; discapacidad solo mediante disabilityVerified. No se equipara cédula estructuralmente válida con identidad/acreditación oficial. Si falta acreditación para la tarifa declarada, BOOKING_BENEFIT_REVIEW_REQUIRED permite orientar a revisión asistida; no se inventa un verificador de producción.
- clock(): Date válido del servidor. Obtener la fecha local mediante calendarDateAt(instant) inyectado; el adaptador usará America/Guayaquil. Copiar el instante para no compartir referencias mutables. Hora/fecha/configuración no proceden del body.
- summaryRevision(summary): SHA-256 de la representación JSON canónica del resumen construido por nuestro dominio, con prefijo de versión bookings-summary-v1. Es un detector de cambio, no autenticación ni firma ni promesa de disponibilidad. No contiene pasajeros legibles. Compara resumen completo: viaje, cooperativa, tramo, fecha, pasajeros, beneficios aplicados y todos los importes.
- getBookingSummary retorna {summary, summaryRevision}; no reserva, no genera ID y no inicia plazo.
- createBooking recibe esos cinco campos más summaryAccepted true y acceptedSummaryRevision (64 caracteres hexadecimales minúsculos). No aceptar precios, identidad, cooperativa, estado o plazo del cliente.
- Antes de reservar: validar y copiar entrada, resolver comprador y consultar catálogo para identificar el bloqueo.
- Dentro de reserve(scope, prepare): consultar otra vez catálogo, acreditación, reloj y resumen; rechazar si el viaje desaparece o cambia de cooperativa. Comparar revisión con la aceptada antes de devolver input/context al repositorio. Si cambió, BOOKING_SUMMARY_CHANGED y ninguna escritura. No recalcular silenciosamente otro precio aceptado.
- proofWindowSeconds se recibe de configuración confiable y se valida con el dominio existente (180–300). newId() es de servidor y solo se llama tras validar la revisión.
- reserve conserva disponibilidad autoritativa y atomicidad; no duplicar las reglas SQL en application. El resultado es la reserva privada persistida de T2.
- Reintento de creación: no prometer idempotencia en esta parte. El mismo asiento ocupado produce conflicto, nunca una segunda reserva incompatible. No reintentar automáticamente tras resultado desconocido; el contrato de recuperación/idempotencia debe cerrarse antes del flujo HTTP.

## Aceptación y pruebas

- Resumen sin escritura ni reloj de pago, copias inmutables, datos personales solo en respuesta privada.
- Entrada extra, aceptación falsa o revisión mal formada rechazan antes de proveedores.
- Comprador ausente, proveedor ausente/fallido o verificación incoherente no crean reservas.
- Menor/tercera edad sin acreditación requiere revisión; beneficio válido mantiene cálculo existente, sin acumulación.
- Precios/pasajeros/beneficios/tramo/cooperativa/fecha modificados invalidan revisión. La revisión no depende del orden de propiedades de entrada ni orden de respuesta de verificaciones.
- El caso de creación relee contexto después del bloqueo, usa la hora nueva para el plazo y rechaza traslado de cooperativa.
- Excepciones propagan sin ocultar errores de almacenamiento ni devolver éxito.
- Integrar los casos con PgBookingRepository y PostgreSQL aislado para probar rollback por cambio de resumen y una sola reserva ante concurrencia.
- Mantener pruebas previas, ejecutar lint, formato y npm test; registrar resultados y limitaciones reales.

## SOLID, usabilidad y límites

Application depende solo de dominio y puertos inyectados. Las revisiones no autorizan acciones; la autorización continúa siendo del proveedor de identidad. Dominio calcula y valida; repositorio decide ocupación atómica. Sin pantalla en T3; los códigos de revisión/cambio permitirán pedir revisión o nueva aceptación conservando los datos introducidos cuando se implemente T4.

No se conecta a app.js/index.js ni se habilita POST público con dobles o inventario simulado. T4 sigue pendiente de catálogo y plantilla reales, identidad compuesta, acreditación/revisión asistida y recuperación segura de una creación de resultado desconocido. Invitados, pagos y expiración quedan en sus entregas respectivas. El PR #17 permanece cerrado sin merge; se recuperará su contrato al implementar la coordinación con pagos, no como PR documental independiente.


## Evidencia A — 29 de octubre de 2026

getBookingSummary implementado localmente con revisión canónica, copia de entradas y puertos de identidad/catálogo/acreditación. Pasaron las 32 pruebas nuevas y las 663 unitarias de la rama. Lint aprobado; formato del código nuevo aprobado. El formato global conserva 27 archivos preexistentes ajenos. Docker no responde (pipe dockerDesktopLinuxEngine ausente); se solicitó abrirlo mientras se continúa trabajo independiente. Integración de este incremento pendiente, sin usar bases existentes. B y T4 siguen pendientes; no hay compra HTTP habilitada.
