# BOOK-01 T2: actualiza la base de reservas y verifica integración

- Responsable: Leslie Coello.
- Revisor propuesto: PabloToapanta.
- Fecha: 25 de octubre de 2026.
- Estado: en ejecución, autorizado por Leslie.
- Base: origin/develop, 67ee38d947058be53e17a0479f4404b1d3c42bf6.
- Rama: feature/BOOK-01-T2-actualiza-base-reservas.

## Objetivo
Preparar los incrementos locales de reservas sobre la base que ya integra flota y hojas de ruta, conservando las ramas originales y la trazabilidad de cada tarea.

## Alcance
1. Trasladar los commits documentales y de dominio con cherry-pick, conservando autoría y referencias de origen.
2. Conservar íntegro el código ajeno de la base y resolver solo conflictos documentales si aparecen.
3. Ejecutar lint, formato y npm test; informar los resultados reales.
4. Comprobar un entorno PostgreSQL exclusivo de pruebas. No leer archivos .env ni usar bases existentes.
5. Revisar las APIs públicas de flota, frecuencias y hojas de ruta para identificar los contratos que siguen pendientes con reservas y pagos.

## Criterios de aceptación
- Las ramas previas y el PR documental #12 permanecen intactos.
- El nuevo HEAD desciende de la base indicada y contiene los mismos archivos de dominio y pruebas de reservas.
- No se ejecuta merge, rebase, push ni se modifica main/develop.
- No se cambian migraciones, dependencias ni pruebas existentes.
- Se documentan fallos, limitaciones y el siguiente incremento concreto; no se declara completa la compra.

## Pruebas y defecto académico
Ejecutar npm run lint, npm run format:check y npm test. No debilitar pruebas. No aplica defecto inducido.

## Revisión documental #12
PabloToapanta aprobó c98db4d572d38387256e828ada1e0e0cee8ff553 el 25 de octubre de 2026. La integración de ese PR sigue siendo una operación separada de esta preparación local.

## Resultado
Traslado local completado y verificado; ramas anteriores intactas. Lint y 470 unitarias aprobadas; formato de reservas aprobado. Formato global fallido por 26 archivos preexistentes; integración pendiente, con 4 aprobadas y 103 fallidas por falta de base de pruebas. Docker requiere intervención de Leslie para iniciar el motor. Evidencia y contratos actuales en docs/reservas-ejecucion.md y docs/reservas-contratos.md. No se presenta esta tarea como integración aprobada ni como entorno de pruebas operativo.

## Verificación posterior con Docker operativo
Completada la comprobación del entorno: contenedor nuevo busesuta-leslie-tests, PostgreSQL 16.13, base busesuta_test vacía antes de las pruebas. Lint y npm test aprobados: 470 unitarias + 107 de integración = 577 pruebas sin fallos. No se cambiaron código, pruebas ni dependencias. La limitación anterior de PostgreSQL queda resuelta; se conserva su evidencia histórica. Persisten los 26 avisos de formato ajenos a reservas y los contratos de producción pendientes. Tarea de preparación y verificación completada; no equivale a aprobar el PR ni a implementar la compra completa.
