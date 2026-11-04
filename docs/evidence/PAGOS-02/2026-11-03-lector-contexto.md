# PAGOS-02: consumidor de lectura con contexto

## Resolución de conflictos publicada en la misma PR #55

Pablo autorizó de forma excepcional actualizar la rama de #55 para que él haga
el merge final desde GitHub. Se incorporó `origin/develop` `feb7f75` sobre la
cabeza `7448e1a`. Los dos conflictos reales fueron `payments/index.js` y
`docs/estado-proyecto.md`: se conservaron la composición de lectura de #55, las
dos capacidades de recepción añadidas en develop y ambas fotografías de estado.
No se incorporó el incremento propio de #56.

Node 24.21.0: lint y formato del archivo resuelto aprobados; las cuatro
exportaciones públicas cargaron; 84 pruebas dirigidas y 1742 unitarias/90 suites
aprobaron. La primera unitaria global quedó limitada por `listen EPERM` dentro
del sandbox y la repetición con acceso local aprobado pasó completa. PostgreSQL
aislado no pudo iniciarse porque Docker Desktop estaba apagado. No se usó `.env`
ni otra base: integración, arranque y contrato conjunto no se atribuyen a esta
cabeza. Los 2200 casos y 12 grupos inferiores pertenecen al candidato anterior
`7448e1a` y se conservan como evidencia histórica, no como repetición nueva.

La aprobación de Pablo existente corresponde a `7448e1a`; la cabeza conciliada
requiere inspección humana final. La PR no queda integrada/cerrada por publicar
esta resolución y #56 permanece separada.

## Preparación histórica anterior de PR #55

3 de noviembre de 2026: PR #55 existe, cabeza publicada `ca63a36`, Draft y
con conflictos. Candidato local `feature/PAGOS-02-prepara-55` sobre develop
`b4fe71704aaab382f62a7220f871cda79be6ffa5`. Esta preparación no actualiza
automáticamente su rama remota. Los apartados inferiores son evidencia histórica
de la primera publicación sobre f5b9bde; sus pendientes se leen con esta sección.

La base actual incluye PR #51 y #60. Se aplican los ocho archivos JS propios
de #55 sin cambios funcionales respecto a ca63a36. Se conservan la compatibilidad
EXPIRED y los archivos de Bookings/Auth/VIP/pantalla de develop. Se reconcilia
la spec conservando su sección de pantalla y el registro sin borrar evidencias
de otros integrantes. No se incluye el script ni package/eslint de #56.

Resultados actuales: lint backend aprobado; formato propio aprobado y global
fallido en los mismos 17 archivos ajenos. Frontend: 205 pruebas y lint aprobados.
Primera ejecución frontend incompleta por omitir los montajes de fixtures y
dominio backend que importa flow.test.js: se corrige el entorno y se repiten
las pruebas completas sin cambiar código ni expectativas.

Contrato conjunto: **12 grupos aprobados** con API pública real de Bookings
de esta base, Auth, PG y archivo privado reales. El runner de QA de #56 se monta
externamente; no se añade a #55. `BOOKINGS_QA_ROOT=/app` señala el backend
actual montado, no un proveedor antiguo ni una ruta de contenedor sin explicar.
Se monta su runner en `/app/qa/contracts/review.cjs` y helpers en `/app/qa/helpers`;
src/scripts/migrations/package JSON del candidato van en `/app`, solo lectura.
PG 16.13 tmpfs en red interna, base exclusiva `pr55_contract_test`; Node 24.21.0
e imagen con dependencias del lock existente. Sin .env ni puertos publicados.
No se ejecuta una mutación de recepción para atribuir disponibilidad comercial:
la recepción sembrada por ese contrato sigue siendo exclusivamente una fixture.

- `npm test` completo: **1676 unitarias + 524 integraciones = 2200 aprobadas**,
  127 suites, salida 0. Integración 156,513 s. No reaparecen los dos fallos de
  reversión de la base anterior.
- Arranque real: `/api/v1/health` 200 y `/api/v1/payment-proofs` sin sesión 401.
- Ocho JS propios idénticos a ca63a36; formato propio y diff completo aprobados.
- Log externo: `C:/Users/VivoBook/.codex/visualizations/2026/11/03/01a19fa6-e4f5-7552-9ce3-50f3b4d1fd44/pr55-actualizacion/backend-npm-test.log`.

GitHub devuelve cero workflow runs para ca63a36. No se atribuye CI verde.
Sin workflow/CI nuevo ni acuerdo humano para sustituir CI por evidencia manual.
Pablo debe revisar la actualización publicada; no hay aprobación nueva atribuida.
Sin merge/push, commit nuevo ni cambio a Ready en esta preparación.

Los recursos QA propios se retiran al terminar. El candidato contiene solamente
los 12 archivos propios de #55 contra b4fe717. Su parche completo y copia de los
archivos resueltos se guardan fuera del repositorio para completar después la
actualización de la rama original, preservando su historial y número de PR.

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
