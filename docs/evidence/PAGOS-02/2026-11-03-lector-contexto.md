# PAGOS-02: consumidor de lectura con contexto

Fecha: 3 de noviembre de 2026, America/Guayaquil.

## Estado comprobado

Base local/remota comprobada por fetch: develop f5b9bde. Rama nueva
feature/PAGOS-02-lector-contexto, sin seguimiento de develop. Shirley autorizó
guardar el commit local al terminar la verificación; su identificador consta en Git.
La pantalla de Shirley está publicada en PR #54 sobre 700bcf3; la consulta GitHub
la encontró abierta y sin integrar. No se modifica esa rama.

Se inspeccionó mediante GitHub la rama pública de Leslie
feature/BOOK-03-resumen-creacion-dominio: index.js exporta
paymentQueries.findForPayment, y payment-booking.js produce el DTO con inicio
explícito y canUploadProof. El código remoto no se incorporó ni ejecutó como
proveedor local. Esta comprobación reemplaza la fotografía anterior que no
encontraba esa rama publicada; no acredita recepción ni confirmación/liberación.

## Cambios

- Caso de uso ListAuthorizedPaymentProofs: contexto mínimo CLERK, copia congelada
  antes de consultar, cooperativa derivada de contexto y propósito REVIEW_PAYMENT.
- Adaptador estricto de PAGOS-02 §17 reutilizado: valida el DTO y conserva errores
  seguros. Relación null/ajena/incoherente es integridad 500; sin listas parciales
  ni importes inventados. Total cero válido se conserva.
- Router de lectura autenticado, con no-store y solo GET listado/archivo. Proyecta
  identidad desde request.auth.user; query/body no eligen actor o cooperativa.
- API pública createPaymentReviewModule con paymentQueries obligatorio. Sin
  fallback al simulador, carga, aprobación o rechazo. No se activa en server.js.
- Presentador HTTP extraído para conservar exactamente el DTO de la bandeja
  anterior. Lectura de bytes privados y pruebas anteriores reutilizadas intactas.

## Verificación real

| Comprobación | Resultado |
|---|---|
| Backend npm run lint | Aprobado |
| Backend npm run format:check | Fallido en 17 archivos previos ajenos |
| Formato de los 8 JS propios | Aprobado |
| Backend npm test | 1317 unitarias + 388 integraciones aprobadas, 1705 total, salida 0 |
| Suites backend | 73 unitarias + 31 integraciones aprobadas |
| Pruebas nuevas | 20 unitarias y 8 de integración aprobadas |
| Frontend npm test de esta base | 144 aprobadas; sin cambios frontend |
| Arranque real server.js | Salud 200 y listado sin sesión 401 |
| git diff --check | Aprobado |

Node 24.21.0 con dependencias existentes del lockfile en la imagen QA, PostgreSQL
16.13 efímero exclusivo y red interna. Solo se montaron src/tests/scripts/
migrations y configuración explícita en solo lectura. Sin montar/leer .env.

La suite nueva utiliza Auth, PostgreSQL, APIs de Payments y archivo reales, con
proveedor de lectura controlado en pruebas. Verifica permisos, dos cooperativas,
contexto mínimo sin campos de identidad del navegador, privacidad del DTO,
integridad ante relación ausente, 400/401/403/500/503 seguros y ausencia de POST.
Las unitarias cubren contexto copiado antes del await y conservan centavos cero.
Esto no sustituye la prueba conjunta con Bookings real.

## Conexión prevista para el responsable de composición

Después de integrar y verificar Bookings, la composición de lectura se prepara
con la API pública:

```js
const { createPaymentReviewModule } = require('./modules/payments');
const paymentReview = createPaymentReviewModule({
  pool,
  auth,
  paymentQueries: bookings.paymentQueries,
  env,
});
```

Montar paymentReview.router sobre el prefijo de comprobantes en la composición
acordada para lectura. No sustituir el módulo completo de escritura ni montar
routers duplicados sin definir precedencia. En este incremento solo se monta en
la aplicación aislada de integración; la aplicación productiva permanece igual.

## Pendientes y límites

Falta integrar el proveedor de Leslie en develop y ejecutar prueba conjunta de
lectura con sus registros reales de QA. Recepción durable, confirmSale,
releaseBooking, correcciones, caja e invitado/correo conservan sus contratos y
tareas. No se afirma venta productiva ni se introducen decisiones de negocio.

Revisor principal Pablo, revisión humana pendiente. Sin migraciones, dependencias,
pruebas anteriores modificadas, defectos académicos, push o PR nuevos.
Contenedores y red temporales retirados al finalizar. Asistencia de IA en código,
pruebas y documentación; no sustituye revisión humana.
