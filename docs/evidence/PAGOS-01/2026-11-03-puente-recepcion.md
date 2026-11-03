# PAGOS-01 — puente interno de recepción, 3 de noviembre de 2026

Base: develop `b4fe71704aaab382f62a7220f871cda79be6ffa5`, integración de PR #60.
Rama: `feature/PAGOS-01-puente-recepcion`. Cambio local; sin commit ni PR nueva.

## Comportamiento comprobado

`createPaymentReceiptModule({ pool, createPaymentProofReceiver })` liga el
receptor público de Bookings a una consulta persistida pública de Payments.
No importa capas internas ajenas. La consulta usa solamente tablas propias y
une comprobante y outbox por sus dos vínculos, sin recibir identidad de navegador.
Devuelve un DTO mínimo congelado; no entrega clave física, bytes ni sesión.

El adaptador verifica resultado, identidad completa y fecha ISO. ACCEPTED
resuelve el puerto existente; REJECTED_EXPIRED confirmado y vinculado se
traduce al rechazo de plazo existente. Cualquier excepción de Bookings o resultado
no verificable conserva incertidumbre, incluso si se lanza una excepción con un
nombre/código de vencimiento. No se decide compensación por un error genérico.

Prueba conjunta de carga interna con lector y receptor reales, almacenamiento
privado y repositorios PostgreSQL: aceptación conserva asientos y entrega aviso;
recepción al vencer compensa archivo/comprobante/outbox y conserva rechazo en
Bookings; COMMIT con respuesta perdida conserva evidencia para recuperar la misma
aceptación; error al marcar entregado mantiene el aviso pendiente; replay después
del plazo y DELIVERED recupera el resultado sin nueva sesión; fuente ausente,
mal vinculada o con cooperativa distinta no acepta ni borra evidencia.

Las reservas se crean con fixtures de QA y el repositorio real. El principal del
lector y middlewares de la prueba son controlados: esto NO prueba la ruta Auth de
carga. El archivo PDF usa una firma sintética acorde al validador existente; no
se prueba decodificación profunda ni se incluye la validación de formatos de la
otra rama. No se confunde la consulta persistida con autorización del comprador.

## Verificación

Node 24.21.0; PostgreSQL 16.13 aislado en tmpfs, red interna sin puertos publicados.
Dependencias de la imagen QA `busesuta-contract-qa:ff79ebd7b1dc`, coincidentes con
SHA256 del lock `ff79ebd7b1dcd47b2b584177215bc7f388e77a9ca924e69d951f8a45402006f3`.
Se montan solo src, tests, scripts, migrations y configuraciones/package JSON
explícitas, en lectura. No se monta ni lee .env.

- Dos suites dirigidas: **37/37 aprobadas** (28 unitarias y 9 integraciones).
- `npm run lint`: aprobado.
- Formato propio: siete archivos JS nuevos/modificados aprobados.
- `npm run format:check`: falla por los mismos 17 archivos ajenos de Hojas de ruta
  y dos migraciones existentes. No se reformatean.
- Arranque real del servidor con PG: `/api/v1/health` 200 y
  `/api/v1/payment-proofs` sin sesión 401. El servidor conserva su composición
  anterior: este arranque no acredita activación del puente.
- `npm test` completo: **1686 unitarias y 525 integraciones aprobadas**, 127 suites,
  salida 0. Integración: 433,202 s. Los dos fallos de reversión conocidos en la
  base anterior no reaparecen sobre esta base con Reservas integrada.

Log completo externo:
`C:/Users/VivoBook/.codex/visualizations/2026/11/03/01a19fa6-e4f5-7552-9ce3-50f3b4d1fd44/pagos-recepcion-reservas/backend-npm-test.log`.

## Reproducción local

Usar Node 24 y dependencias del lock, con PostgreSQL aislado según
`docs/testing-database.md`. Desde la raíz, en PowerShell:

```powershell
docker compose -f docker-compose.test.yml up -d --wait
$env:DATABASE_URL = 'postgres://test_user:test_only_password@localhost:55433/busesuta_test'
$env:NODE_ENV = 'test'
Set-Location backend
npx --no-install jest tests/unit/payments/bookings-payment-proof-notifier.test.js tests/integration/payments/booking-proof-receipt.test.js --runInBand
npm run lint
npm run format:check
npm test
Set-Location ..
docker compose -f docker-compose.test.yml down
```

Las suites comprueban el guard de base `_test`, aplican migraciones originales
y limpian únicamente datos de QA. Esta reproducción no usa otro proveedor montado
en `/app/provider`: los dos módulos están en la misma base integrada de #60.

Ejemplo de composición exclusivamente interna, no endpoint público:

```js
const paymentsReceipt = createPaymentReceiptModule({
  pool,
  createPaymentProofReceiver: bookings.createPaymentProofReceiver,
});
// Inyectar paymentsReceipt.bookingPaymentProofNotifier al caso de uso
// solo cuando su lector UPLOAD_PROOF reciba contexto de Auth real.
```

## Pendientes explícitos

No se cambia server.js ni se activa la capacidad desde HTTP. Siguiente incremento:
conectar carga inicial a UPLOAD_PROOF y Auth reales y probar esa procedencia antes
de habilitar el receptor. No incluye venta, rechazo de oficinista, correcciones,
caja, invitado ni planificador de outbox/expiración.
Las PR #55/#56 y la validación de formatos siguen separadas, con sus pendientes.
Revisión humana de Pablo/Leslie y comprobación de CI remota pendientes. No hay
acuerdo nuevo para sustituir CI por evidencia manual. Sin defectos académicos,
migraciones/dependencias modificadas o pruebas previas alteradas.

Diff completo revisado, incluidas las altas; `git diff --check` aprobado.
Contenedores y red propios de QA retirados al finalizar; servicios ajenos intactos.
