# PR #62: unificación con el puente integrado

3 de noviembre de 2026, America/Guayaquil. Leslie solicita corregir el programa tras los conflictos. Rama feature/BOOK-06-adaptador-aviso-pagos, HEAD publicado 4030709; develop incorporado 61fd65a integra 9131787 de Shirley. PR #62 abierta hacia develop; no se integra desde esta tarea.

## Diagnóstico

Tres conflictos reproducidos: payments/index.js, infrastructure/bookings-payment-proof-notifier.js y su suite unitaria. Ambas ramas añadieron un puente con el mismo nombre. La fuente SQL y createPaymentReceiptModule ya están integradas en develop; no deben sustituirse por la preparación anterior de C1.

## Resolución

- Se conserva createPaymentReceiptModule, PgPaymentProofReceiptSource y el puerto integrado markPaymentProofReceived que resuelve undefined y conserva VALIDATION_ERROR para entradas inválidas.
- Dominio compartido captura solicitud y respuesta una vez. receiptResult valida y congela; acknowledgeReceipt solo puede convertir el resultado validado en rechazo definitivo. La lectura de payload/proveedor está separada de esa señal: un getter que lance una excepción de plazo no certifica rechazo durable.
- BookingsPaymentProofNotifier captura el método ligado y expone internamente receiveAcknowledgement para reutilizar la misma operación. Su puerto original mantiene retorno undefined.
- La fábrica pública de Leslie es una fachada pequeña en create-booking-payment-proof-notifier.js sobre ese puente, conservando su resultado congelado y clasificación de incertidumbre. No hay dos implementaciones independientes ni dos avisos.
- Las 31 pruebas originales de la fábrica pasan a booking-receipt-notifier-factory.test.js. La suite integrada conserva su ruta. Comparación byte a byte aprobada contra 4030709 y origin/develop, respectivamente; ninguna aserción se borra o rebaja.
- Siete regresiones adicionales verifican getters de entrada/respuesta que lanzan plazo, captura única del outcome/IDs y enlace del método en el puerto integrado. Las pruebas existentes conservan su verificación de ambos contratos.

No cambian la fuente persistida, migraciones, dependencias, casos de uso, servidor, rutas ni frontend. No se activan carga o aprobación productivas ni se modifican tiempos de fotografías.

## Verificación

Node 24.21.0; PostgreSQL 16.13 temporal exclusivo busesuta-leslie-pr62-conciliacion, tmpfs/puerto 55433. Sin .env ni bases persistentes.

- Unitarias dirigidas: 66/66, tres suites, ambos contratos y regresiones.
- Integraciones dirigidas: 14/14, 5,671 s. Incluyen las pruebas de fuente QA de Leslie y las del puente de Shirley con comprobante/outbox/archivo reales: aceptación, compensación solo tras rechazo confirmado, COMMIT perdido y reintento, fallo al marcar entregado y errores de fuente/vínculos sin borrado.
- Lint aprobado. Format:check global conserva los 17 archivos ajenos previos, sin reformatearlos.
- npm test completo: 1724/1724 unitarias aprobadas (89 suites); integración 529/530, 40 suites aprobadas y una fallida, 324,691 s. Salida global 1. Único fallo: tests/integration/fleet/bus-photo-storage.test.js, caso de preparación/promoción de todos los bytes, timeout original de 20000 ms.
- Repetición aislada de ese archivo, sin cambios de código/aserciones/timeout: 17/18 aprobadas, mismo timeout reproducido, 32,243 s, salida 1. No se declara suite global aprobada ni se atribuye el fallo a esta conciliación: archivo y código de Fleet son idénticos a develop. Causa precisa pendiente de diagnóstico separado; la ausencia de cambios no prueba por sí sola su causa.
- Arranque real incluido entre las integraciones aprobadas; los 14 casos dirigidos de Pagos/Reservas pasan. Formato propio de los ocho JS del puente/tests aprobado. Sin pruebas frontend porque no cambian sus archivos ni flujo.
- Diff completo revisado, incluidos archivos nuevos y traslado de la suite; git diff --check y comprobación de staging aprobados. Migraciones y fuente SQL integradas intactas.
- Limpieza comprobada: contenedor/red busesuta-leslie-pr62-conciliacion retirados y filtros por etiqueta vacíos, sin detener servicios ajenos.

## Límites

La fuente persistida está preparada en createPaymentReceiptModule; esto no acredita la autorización HTTP de carga ni convierte cargas históricas con lector simulado en procedencia verificada. No activar server.js como parte de resolver un conflicto. PR #55/#56 y la conexión productiva mantienen sus alcances separados.

La descripción de PR #62 debe reflejar este diff contra develop: compatibilidad y endurecimiento del puente integrado, con todas las pruebas preservadas. Revisión humana del commit nuevo e integración pendientes.

La resolución se guarda y publica mediante commit de conciliación con padres 4030709 y 61fd65a, consultable en el historial de PR #62. Revisión humana del commit nuevo y evaluación del fallo global pendientes antes de integrar. [Descripción actualizada](descripcion-pr.md).
