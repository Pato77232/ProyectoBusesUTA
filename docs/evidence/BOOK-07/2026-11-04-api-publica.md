# BOOK-07: API pública de confirmación con intención versionada

4 de noviembre de 2026, America/Guayaquil. Rama feature/BOOK-07-confirmacion-venta, HEAD inicial limpio df3370b. Leslie solicita API y conexión real antes de abrir PR. Trabajo asistido por Codex; no sustituye revisión humana.

## Disponibilidad comprobada

Fetch develop da9c678, sin cambios nuevos; consulta de PR abierta #72 auditoría de Route Sheets. Ramas PAGOS consultadas por ls-remote: PAGOS-02-aprobar-comprobante c1d638f, PAGOS-02-develop-actualizado 2f30fc8 documental. Código disponible sin proofVersion/consulta de intención pública; Payments construye SimulatedBookingSaleConfirmer. Leslie confirma mediante respuesta en este chat que Shirley no compartió otra rama/commit y solo dispone de los mensajes. No se afirma conocer su trabajo local ni se duplica la implementación pendiente.

## Implementado en Bookings

BOOK-07 §18 fija el incremento: aplicación confirm-sale.use-case.js y fábrica createPaymentSaleConfirmer({approvalSource}) exportada por el módulo. Conserva firma de tres identificadores, fuente obligatoria sin fallback, verifica versión/vínculos/actor/fecha y valida resultado tras persistencia. Consulta fuente en cada reintento; fallos técnicos/ausencia quedan inciertos, no se aprueba ni libera. Errores sanitizados sin datos SQL/rutas. No endpoint HTTP nuevo ni acceso a tablas privadas de Payments.

No nuevas migraciones/dependencias ni cambios de server/composición productiva. Existente persistencia de venta y estados CONFIRMED/SOLD se conservan. Contrato de consumo y clasificación de códigos en docs/contratos/confirmacion-venta-bookings-api.md; aclara que la aprobación de Payments sigue simulada hasta conectar su proveedor real y adaptador, sin presentar QA como integración cerrada.

## Verificación parcial real

100 pruebas unitarias dirigidas aprobadas (40 nuevas y 60 de intención existentes). 30 integraciones dirigidas aprobadas (11 nuevas por API pública y 19 de persistencia). Nuevas integraciones usan PostgreSQL real y fuente QA persistida explícita en esquema saleapiqa_<UUID>; incluyen barrera pg_blocking_pids, versión ausente/distinta, misma identidad por otra instancia y respuesta perdida tras COMMIT real.

Lint aprobado; formato de cuatro archivos propios iniciales aprobado y formato global conserva 17 archivos ajenos sin cambios. npm test completo en ejecución con PostgreSQL 16.13 exclusivo leslie-book07-api, tmpfs/55433, NODE_ENV=test y busesuta_test, --env-file NUL. No .env ni bases persistentes; no cambiar fotos/timeout ni repetir buscando verde. Falta registrar resultado final y limpieza.

Sin commit/push/PR o declaración de integración. La dependencia restante de proveedor productivo es explícita; no se considera la fuente QA autorización o evidencia de bloqueo de archivos de Payments en producción.

## Resultado final

npm test completo salida 0: 1944/1944 unitarias en 98 suites (12,897 s) y 619/619 integraciones en 49 suites (440,258 s). Total 2563 pruebas en 147 suites. Incluye 40 nuevas unitarias y 11 nuevas integraciones de API pública, además de regresión de persistencia/recepción/expiración y arranque real existente. No se atribuye a esos tests una conexión real de intención de Payments o revisión de autenticación con la fuente QA.

Lint aprobado. Formato propio de cinco JS aprobado; formato global conserva 17 archivos ajenos sin modificar. Fotografías pasó con timeout original, sin repetición para buscar verde. Ninguna migración/dependencia/server/composición productiva modificada. Contenedor y red exclusivos leslie-book07-api eliminados tras la suite, sin tocar bases persistentes. Diff/alcance/enlaces revisados, git diff --check sin errores.

API pública de Bookings implementada y verificada localmente, revisión humana pendiente. No commit/push ni PR en esta sesión. Conexión productiva pendiente de rama/commit del proveedor versionado de Shirley (persistencia, bloqueo, consulta y adaptador de aprobación), inexistente en las referencias publicadas revisadas y no facilitado por Leslie. Hasta recibirlo no se presenta una aprobación completa entre módulos ni se abre PR como tal. No se solicita otro acuerdo de negocio sobre versiones/históricos ya confirmados.

Leslie autoriza guardar y publicar este incremento el 4 de noviembre de 2026 para compartir la API/contrato con Shirley. Sin cambios funcionales posteriores a las 2563 pruebas aprobadas; no se abre ni integra PR y la conexión productiva sigue pendiente de su proveedor real.
