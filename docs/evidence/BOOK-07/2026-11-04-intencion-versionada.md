# BOOK-07: validación pura de intención versionada y reintentos

4 de noviembre de 2026, America/Guayaquil. Rama feature/BOOK-07-confirmacion-venta, base ae88e0c. Trabajo original conservado sin incorporar cotización 32afe9d, publicada en su propia rama. Asistencia de Codex en implementación, pruebas y documentación.

## Autorización y acuerdos

Leslie pide continuar; comparte confirmación de Shirley sobre proofVersion, consulta pública/bloqueo y traducción de confirmación/rechazo/incertidumbre. Leslie confirma después el tratamiento conservador de históricos: preservar sin versionar/procesar automáticamente y mantener bloqueo con intención pendiente/incierta. Registro en BOOK-07 §15. Esas respuestas no acreditan implementación productiva de Payments ni aprobación humana del código.

Fetch origin/develop y consulta de PR abiertas: base ae88e0c, sin PR abierta accesible. ls-remote conserva PAGOS-02-aprobar-comprobante c1d638f; el mensaje de Shirley no incluye nuevo commit publicado con su contrato actualizado. No se inventa ni se lee trabajo local ajeno. Árbol previo contenía solo la preparación documental ya autorizada.

## Alcance implementado

Archivos nuevos booking-sale-attempt.js, booking-sale-error.js y booking-sale-attempt.test.js. Intención interna con tres vínculos exactos, versión positiva, actor y fecha canónica. Recuperación solo de resultado explícito persistido, validando versión, actor/fecha originales, USD, centavos exactos y coherencia temporal. No hay mutaciones; copias congeladas y serializables. null significa ausencia, no error técnico/malformado.

No acredita permisos, no crea venta, no modifica asientos y no se expone desde index.js. El adaptador futuro debe aportar la fuente verificada y convertir el DTO público de Payments, aún no disponible. No se cambia confirmSale ni se sustituye su simulador. Ninguna migración, composición, dependencia o frontend modificados; sin .env, secretos o bases persistentes.

## Verificación inicial

60/60 unitarias nuevas aprobadas. Lint salida 0; formato propio de los tres archivos aprobado. format:check global salida 1 en los mismos 17 archivos ajenos (15 Route Sheets/dos migraciones); no modificados. npm test completo en ejecución sobre PostgreSQL 16.13 exclusivo leslie-book07-intento, tmpfs/puerto 55433, NODE_ENV=test y busesuta_test, --env-file NUL. No alterar fotografías ni repetir para buscar verde.

Pendiente resultado completo, limpieza del contenedor y revisión final. Los 2498 tests de la rama de cotización no se atribuyen a esta base o implementación. Los 32 escenarios documentales de venta siguen como plan, no suite integrada ejecutada. Sin commit/push o declaración de integración; revisión humana pendiente.

## Resultado final real

npm test ejecutado completo, salida 1. Unitarias: 1902/1902 aprobadas en 97 suites (12,932 s), incluidas las 60 nuevas. Integraciones: 587/588 aprobadas en 46/47 suites (385,283 s). Único fallo: tests/integration/fleet/bus-photo-storage.test.js:23, prepara/promueve bytes, timeout original de 20000 ms. No se editó esa prueba ni el almacenamiento de fotos ni se aumentó el timeout; no se repitió buscando verde. Total ejecutado: 2490 pruebas, 2489 aprobadas y una fallida; 144 suites, una fallida. No declarar suite global verde.

Lint salida 0, formato propio salida 0. format:check global salida 1 en los mismos 17 archivos ajenos; sin cambios. Integraciones existentes de Bookings/Payments/arranque aprobadas, sin afirmar prueba de confirmSale productiva. Sin cambios de composición no se hizo otro arranque manual separado.

PostgreSQL temporal exclusivo y red leslie-book07-intento eliminados con compose down después de las pruebas. Se revisaron diff y enlaces locales; git diff --check sin errores. Nuevos archivos solo de dominio/tests y documentación. No migraciones ni escrituras productivas. Sin commit/push, revisión humana e implementación de persistencia/caso de uso/conexión siguen pendientes.
