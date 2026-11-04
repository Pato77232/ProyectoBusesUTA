# BOOK-05-L01: preparación y cálculo puro de cotización configurable

4 de noviembre de 2026, America/Guayaquil. Leslie solicita continuar con el siguiente paso propuesto tras integrar disponibilidad. Asistencia de Codex en revisión y documentación; no sustituye aprobación humana.

## Estado comprobado

PR #70 merged a develop mediante ae88e0c694bedcfa384386548d2ba40cd193669a (GitHub 2026-11-04T05:25:24Z). Fetch confirmó ese origin/develop. Árbol original limpio antes de preparar feature/BOOK-05-cotizacion-configurable desde ese commit, sin checkout de main/develop. Consulta de PR abiertas sin resultados; no se presupone conocer ramas locales ajenas.

Se revisaron AGENTS, guia-proyecto, flujo-codex, arquitectura, calidad, reglas/acuerdos, BOOK-05-L01, tabla monetaria y código de cotización/viajes. La cotización histórica aún usa descuento fijo y suma de tramos; no es el contrato nuevo. No se alteró.

## Resultado documental

BOOK-05-L01 §15 concreta propuesta de racionales para componentes y ajuste, fecha de embarque para edad y decisiones pendientes de acreditación. Acuerdos previos de máximo sin acumulación, empates y acreditación antes del total se conservan. Consultas enviadas a Leslie; ninguna respuesta nueva se inventa.

Brecha de proveedor verificada en evaluate-commercial-trip.js y restore-commercial-trip.js: tarifa/política/boardingAt sí públicos; inventario público solo seatIds, sin categoría congelada. Se propone contrato aditivo a David, no implementado ni aprobado por él. No consultar repositorios privados ni sustituir con inventario actual.

## Comprobación y límites

Verificador efímero con fractions.Fraction: 24/24 casos C01–C24 comprobaron recargo, beneficio, total exacto, redondeo mitad arriba y conciliación con residuo. La primera ejecución falló por índice de columna del verificador; la segunda corrigió el índice y aprobó sin modificar cifras. No es suite funcional del producto.

Solo documentos; sin nuevas dependencias, secretos, migraciones, bases, frontend ni cambios de composición. No se repiten lint/formato/npm test o arranque para esta preparación documental. No reutilizar los 2430 tests de PR #70 como pruebas de la política nueva. Diff documental revisado y git diff --check ejecutado. Sin commit/push ni integración de este incremento.

Pendientes: decisiones de desglose/edad/acreditación, contrato público de categorías, flujo de total cero y límite de compra antes de habilitar operación comercial. Próximo código solo tras cerrar los requisitos de su incremento y su autorización; la preparación no abre la compra.

## Decisiones recibidas e implementación aislada

Leslie confirma ambas reglas de desglose/edad y luego el procedimiento concreto de acreditación. Registro en BOOK-05-L01 §16; sustituye los pendientes anteriores en esas decisiones, sin afirmar disponibilidad de APIs ni revisión de compañeros. Se ejecuta el incremento puro bajo su solicitud de continuar con lo pendiente, sin habilitar el flujo comercial.

Archivos nuevos: domain/configured-passenger-quote.js y tests/unit/bookings/configured-passenger-quote.test.js. Solo dominio JavaScript; BigInt para exactitud, racionales reducidos serializables, máximo/empates, validación explícita y fecha de embarque previamente resuelta. No sumar tramos ni aplicar 50 % fijo. Reutiliza ageOnDate sin modificar el archivo ni las pruebas históricas. Integración de categorías/acreditación/zona y resumen comercial aún pendiente.

Primera verificación dirigida: 100/100 pruebas en dos suites aprobadas, incluyendo la suite histórica. Lint aprobado. format:check global falla en los mismos 17 archivos ajenos (15 de Route Sheets y dos migraciones); no se modifican. Prettier de ambos archivos propios aprobado. npm test completo en ejecución con PostgreSQL 16.13 exclusivo leslie-book05-cotizacion, tmpfs y puerto 55433, NODE_ENV=test/base busesuta_test; --env-file NUL. No se inspecciona ni modifica ninguna base persistente. No se cambia timeout de fotografías ni se repite buscando verde.

Pendiente registrar resultado completo, eliminación del entorno y revisión final del diff antes de recomendar commit. No se hace commit/push automáticamente.

## Resultado final del incremento puro

npm test completo terminó con salida 0: 1910/1910 unitarias en 97 suites (11,091 s) y 588/588 integraciones en 47 suites (374,826 s). Total 2498 pruebas, 144 suites. El archivo nuevo aporta 68 casos; junto con la suite histórica dirigida son 100. Fotografías pasó con su timeout original; no se cambió ni se repitió para buscar verde. Las suites integradas incluyen arranque real y el proveedor de disponibilidad ya compuesto; no verifican una nueva conexión comercial de cotización.

Lint salida 0. format:check global salida 1 por los 17 archivos ajenos previamente identificados; formato propio salida 0. PostgreSQL exclusivo eliminado mediante compose down tras las pruebas; ninguna base persistente tocada. Verificación y revisión del diff final completadas, sin modificaciones a código de composición, migraciones o pruebas existentes. Sin dependencias nuevas.

Resultado verificable: cálculo configurable y exacto, aislado y sin efectos, con evidencia histórica conservada. No hay proveedor productivo de acreditación, categorías congeladas en el DTO público ni conversión de fecha comercial conectados al nuevo servicio. No se declara finalizada L-01 ni compra completa, CI remoto, revisión humana o integración. Cambios locales sin commit/push; se recomienda un commit atómico del incremento matemático cuando Leslie lo solicite y mantener la PR funcional de resumen pendiente de sus contratos.

Guardado autorizado por Leslie el 4 de noviembre: commit atómico del cálculo puro, sus pruebas y documentación. Publicación no solicitada en esta confirmación; revisión humana y conexión comercial pendientes. Los resultados anteriores se conservan, sin cambios funcionales posteriores a la suite.
