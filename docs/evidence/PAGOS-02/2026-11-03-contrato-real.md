# PAGOS-02: lectura conjunta con Bookings real

Fecha: 3 de noviembre de 2026, America/Guayaquil.

## Revisiones comprobadas

- Consumidor de Pagos: ca63a3647788557749c2c96c60d459f7df8f0e0f, PR #55 abierta
  en borrador al comenzar. Pantalla: PR #54 abierta, revisión independiente.
- Proveedor de Leslie: 901d30897ce2668581f25b2e4e055235b8171939 de
  feature/BOOK-03-resumen-creacion-dominio, obtenido mediante fetch.
- Rama del ensayo: feature/PAGOS-02-prueba-lector-real, desde ca63a36.
- Lockfile de ambos: SHA256
  FF79EBD7B1DCD47B2B584177215BC7F388E77A9CA924E69D951F8A45402006F3.

Se exportaron únicamente backend/src, migrations, scripts, package.json y
package-lock.json con git archive del commit fijado. El snapshot se montó de solo
lectura, sin .env ni cambios a los archivos de Leslie. No se ejecutó merge/rebase
ni se incorporó el proveedor al producto.

## Resultado real

`npm run test:contract:bookings` terminó con salida 0 y **12 grupos de
comprobaciones aprobados**, usando createBookingsModule(...).paymentQueries,
createPaymentReviewModule, Auth, PostgreSQL 16.13 y archivos privados reales.
No hay stub del lector, de su repositorio o de la conexión PostgreSQL.

1. DTO público con total persistido, inicio explícito diferente de createdAt,
   canUploadProof y ausencia de ownerId para CLERK.
2. Otra cooperativa obtiene null y CUSTOMER no puede usar REVIEW_PAYMENT.
3. Antes del límite se conserva elegibilidad.
4. En el límite se deniega elegibilidad.
5. Después del límite se deniega elegibilidad.
6. Lecturas anteriores no cambian filas de reserva ni ocupaciones.
7. GET de Pagos usa sesión real y no acepta tenant/actor de query; conserva
   total, DTO privado y no-store.
8. La segunda cooperativa solo recibe su propio comprobante.
9. Archivo propio devuelve bytes PNG y no-store; el ajeno devuelve 404.
10. CUSTOMER recibe 403 y la ausencia de sesión recibe 401.
11. Recepción sembrada exclusivamente como fixture deshabilita carga y permite
    seguir consultando después del plazo; no acredita una API de recepción.
12. Total incoherente en summary devuelve integridad 500, sin lista parcial.

Los datos se insertaron exclusivamente como fixtures de prueba. El esquema se
obtuvo ejecutando las migraciones originales del proveedor mediante su migrador;
no se editaron migraciones ni se construyó el esquema manualmente. No se probaron
creación de reserva, aceptación de comprobante, expiración, venta o liberación.

## Reproducción

El script nuevo está en backend/tests/contracts/real-bookings-payment-review.cjs.
Falla si faltan base *_test, NODE_ENV=test o ruta absoluta del proveedor; no se
omite automáticamente. Al exigir dos revisiones no integradas, es una ejecución
explícita fuera de Jest ordinario; no se retiraron pruebas del npm test existente.
Las reglas normales de ESLint ahora incluyen tests/contracts/**/*.cjs.

Para preparar el proveedor, desde Git Bash, en una carpeta temporal nueva:

```bash
QA_DIR="$(mktemp -d)"
git fetch origin feature/BOOK-03-resumen-creacion-dominio
mkdir -p "$QA_DIR/provider"
git archive --format=tar \
  --output="$QA_DIR/provider.tar" \
  901d30897ce2668581f25b2e4e055235b8171939 \
  backend/src backend/migrations backend/scripts \
  backend/package.json backend/package-lock.json
tar -xf "$QA_DIR/provider.tar" -C "$QA_DIR/provider"
```

QA_DIR identifica el directorio temporal exclusivo creado para este ensayo.
Usar PostgreSQL efímero con base terminada en _test y credenciales ficticias,
según docs/testing-database.md. En Node 24 con dependencias exactas del lockfile:

```bash
cd backend
NODE_ENV=test \
DATABASE_URL="postgres://test_user:test_only_password@db:5432/pagos_real_test" \
BOOKINGS_QA_ROOT="/app/provider/backend" \
npm run test:contract:bookings
```

En la ejecución registrada se utilizó la imagen QA existente
busesuta-pr48-qa:20261102, con el lockfile coincidente. Se montaron los directorios
del consumidor en /app y el snapshot en /app/provider, todos en solo lectura.
La ruta del snapshot dentro de /app permite resolver las dependencias compartidas
desde /app/node_modules. Para otra máquina se requiere preparar un entorno Node
24 con npm ci del lockfile, incluidas herramientas de desarrollo; no paquetes nuevos.

## Regresión y calidad

- npm test ordinario, contra otra base limpia sin las migraciones externas:
  1317 unitarias + 388 integraciones aprobadas, salida 0.
- npm run lint aprobado, incluido el script CJS nuevo.
- Formato del script y package.json aprobado; git diff --check aprobado.
- npm run format:check falla en los mismos 17 archivos previos ajenos.
- Sin cambios a src, migraciones, dependencias o pruebas anteriores. Arranque
  productivo no repetido por este ensayo: no cambia la composición. La aplicación
  conjunta sí arrancó con ambos módulos reales para las comprobaciones HTTP.

La primera ejecución completó las aserciones pero terminó fallida por una
referencia incorrecta al limpiar archivos. Se corrigió y repitió con salida 0;
la salida de éxito se emite únicamente después de cerrar archivos/conexiones.

Bases, contenedores y red temporales retirados. Snapshot de solo lectura queda
como artefacto local de QA fuera del repositorio; no contiene datos personales.

## Estado y límites

La compatibilidad de lectura entre estas dos revisiones queda comprobada en QA.
La integración en develop, montaje productivo y revisión humana de Pablo siguen
pendientes; las PR #54/#55 no se dan por aprobadas ni integradas por este ensayo.

Esta rama depende de PR #55. La PR debe dirigirse a develop conforme a
docs/conventions.md. Mientras #55 esté abierta, publicar el ensayo como borrador
e indicar que la comparación incluye también ca63a36 de esa dependencia.
Integrar primero #55 y volver a comprobar el diff antes de integrar este ensayo;
no atribuir a esta entrega el código del consumidor ya presentado en #55.

Recepción durable, confirmSale, releaseBooking, correcciones, caja, QR y correo
conservan sus tareas/contratos. Sembrar un estado de recepción no los implementa.
Sin commits, push, PR nueva, mensajes enviados ni defectos académicos.
Asistencia de IA en el ensayo y documentación; revisión humana pendiente.
