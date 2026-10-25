# Evidencia de reservas

## Base
Referencia local de develop: 1de771370a06a7d478d4f4a0d8c56f209139070d. Copia aislada; autor de commits Leslie Coello. No se ha actualizado la referencia remota mediante red ni integrado trabajo ajeno.

## BOOK-01 — especificaciones
- Ocho specs y decisiones de producto documentadas conforme autorización de Leslie.
- Node 24.21.0; dependencias de package-lock instaladas sin cambiar versiones. El primer intento falló por permisos y el segundo por corte de red; el reintento terminó correctamente.
- npm run lint: aprobado.
- npm test: 175 pruebas unitarias aprobadas; 81 de integración fallidas por ausencia de base de pruebas y restricciones de conexión local. No se omitieron pruebas ni se cambió su contenido. Docker no estaba disponible en la revisión de entorno.
- Es un commit documental local; no se considera una integración aprobada ni se acredita funcionamiento completo del módulo.

## Operaciones Git
Cada incremento se conserva en una rama de tarea. Los incrementos posteriores pueden estar apilados sobre la rama anterior: revisar únicamente su diferencia respecto del padre indicado. Las recomendaciones de PR no ejecutan push ni merge. Revisor: Edwin.

## Preparación del PR documental en la carpeta original
Los seis commits se trasladaron previamente a la carpeta original de OneDrive por instrucción de Leslie. Esta rama documental se prepara allí. Se verificó por la conexión GitHub que develop sigue en la misma base; Git por HTTPS presenta cortes de conexión.

Se aclararon las decisiones autorizadas por Leslie y los contratos todavía no confirmados. No se presenta aprobación del equipo ni del revisor. Se conservaron los seis commits locales y las ramas de código.

Se intentó iniciar Docker y su servicio; Windows denegó acceso al servicio y el motor siguió ausente. No se alteraron privilegios del sistema ni bases de datos existentes. Los resultados de pruebas históricos anteriores corresponden a sus ejecuciones; la verificación de esta rama se registra al finalizar.

Verificación de esta rama documental en la carpeta original: lint y formato aprobados; npm test ejecutado con 175 unitarias y 4 HTTP aprobadas, 77 de integración fallidas por falta de URL/base de pruebas. El comando completo sigue fallido. No incluye las pruebas nuevas de dominio, que permanecen en sus ramas de código.
## BOOK-02 T1 — disponibilidad de dominio
- Base: feature/BOOK-01-especificaciones-reservas. Rama: feature/BOOK-02-T1-disponibilidad-dominio.
- Implementada consulta pura por viaje, cooperativa, asiento y tramo; no hay endpoint, persistencia ni pantalla todavía.
- 32 pruebas nuevas; 207 unitarias aprobadas en total. Lint y formato de archivos nuevos aprobados.
- npm test: integración sigue fallida (81 pruebas) por la configuración de entorno ya descrita. Sin cambios en pruebas existentes.
- No valida concurrencia de escritura: eso corresponde al bloqueo transaccional de BOOK-03.

## BOOK-04 T1 — pasajero por asiento
- Base: feature/BOOK-02-T1-disponibilidad-dominio. Rama: feature/BOOK-04-T1-pasajeros-dominio.
- Objeto mínimo inmutable; exige asiento y cédula como texto, conserva ceros y rechaza propiedades extra. No acredita documentos ni incorpora persistencia o formulario.
- 25 pruebas nuevas; 232 unitarias aprobadas en total. Lint y formato de archivos nuevos aprobados.
- npm test ejecutado: integración continúa sin base de pruebas; no es aceptación de producción.

## BOOK-06 T1 — plazo configurable
- Base: feature/BOOK-04-T1-pasajeros-dominio. Rama: feature/BOOK-06-T1-plazo-reserva.
- Política pura sin configuración oculta: plazo explícito de 180 a 300 segundos, comparación en el límite y protección de comprobante en revisión.
- 24 pruebas nuevas; 256 unitarias aprobadas en total. Lint y formato de archivos nuevos aprobados.
- npm test ejecutado; integración sigue sin base de pruebas en esta ejecución. Aún no hay liberación persistida ni proceso periódico: T2/T3 dependen de BOOK-03 y pagos.

## BOOK-04 T1b — comprobación local de cédula
- Base: feature/BOOK-06-T1-plazo-reserva. Rama: feature/BOOK-04-T1b-valida-cedula.
- Validador independiente de estructura/módulo 10 con fuentes oficiales y datos sintéticos. No consulta identidad real ni modifica el objeto mínimo o pruebas de T1.
- 15 pruebas nuevas; 271 unitarias aprobadas en total. Lint y formato de archivos nuevos aprobados. npm test ejecutado con integración sin base de pruebas.
- Se intentó iniciar Docker en segundo plano, pero su motor siguió sin estar disponible. No se creó ni limpió ninguna base de datos existente.

## BOOK-05 T2 — cotización individual
- Base: feature/BOOK-04-T1b-valida-cedula. Rama: feature/BOOK-05-T2-calcula-descuentos.
- Política de T1 registrada en reservas-decisiones.md; cálculo puro de tarifa por tramos en centavos, edad en salida, descuento único y redondeo por pasajero. No acredita identidad, no cobra ni obtiene tarifas del navegador.
- 32 pruebas nuevas; 303 unitarias aprobadas en total, de las cuales 128 pertenecen a las tareas de reservas.
- npm run lint y npm run format:check aprobados. Formato de todas las pruebas nuevas también aprobado.
- Verificación final npm test fuera de la restricción de conexión local: 303 unitarias y 4 pruebas HTTP de infraestructura aprobadas; 77 pruebas de integración fallidas por falta de URL/base de pruebas. El comando completo sigue fallido. Docker continúa sin motor disponible incluso fuera del sandbox.
- No se cambió ninguna prueba existente, migración, versión de dependencia ni configuración global de Git. Trabajo asistido por Codex siguiendo las convenciones y archivos de OpenCode, con autorización de Leslie para ramas y commits.

## Próximo incremento y PR
Recomendar ahora PR documental de feature/BOOK-01-especificaciones-reservas hacia develop para que Edwin revise alcance y decisiones. Los incrementos de código se pueden revisar en borrador contra su rama padre; no recomendar integrarlos como funcionalidad completa hasta verificar PostgreSQL y los contratos reales.

El siguiente incremento ejecutable de extremo a extremo es BOOK-02 T2: acordar e implementar puertos/adaptadores de viaje y plantilla. BOOK-03 requiere esas fuentes y un contrato de comprador. BOOK-06 T2 y BOOK-07 requieren la operación atómica de reserva/comprobante de Shirley. BOOK-08 requiere una base frontend conectada. No se sustituyen con datos ficticios en producción ni se declara el módulo terminado.

## BOOK-04 T1c — datos completos del pasajero
Trabajo en la carpeta original el 25 de octubre de 2026. Base feature/BOOK-05-T2-calcula-descuentos (19fe2d8); rama feature/BOOK-04-T1c-datos-pasajero. Se compone el pasajero mínimo con validación local de cédula, nombre Unicode y nacimiento civil no futuro respecto de una fecha explícita de servidor. No se certifica identidad ni beneficios.

65 pruebas nuevas; 368 unitarias aprobadas. Lint y formato aprobados. npm test completo fallido: 4 HTTP aprobadas y 77 pruebas de integración fallidas por ausencia de URL/base PostgreSQL. No se usó una base de datos existente. La rama documental del PR #12 se conserva sin cambios. Se conserva esta tarea en commit local por autorización de Leslie; no es una aceptación de integración.

## BOOK-04 T1d — correspondencia entre pasajeros y selección
Trabajo en la carpeta original el 25 de octubre de 2026. Base feature/BOOK-04-T1c-datos-pasajero (1dd0e6c); rama feature/BOOK-04-T1d-pasajeros-seleccion. Se exige exactamente un pasajero completo por asiento seleccionado y se conserva el orden de la selección. Se rechazan cantidades diferentes, asientos repetidos, pasajeros ajenos o inválidos y listas dispersas, sin modificar entradas. No se añade una prohibición de cédula repetida no acordada.

38 pruebas nuevas; 406 unitarias aprobadas en total (103 nuevas en T1c/T1d). Lint y formato aprobados. npm test completo sigue fallido: 4 HTTP aprobadas y 77 pruebas de integración fallidas por falta de URL/base PostgreSQL. No se debilitó ninguna prueba anterior ni se usó una base existente.

Las ramas T1c/T1d son incrementos apilados sobre el código previo de reservas, no sobre el develop actual que ya incorpora flota. El PR documental #12 permanece en c98db4d. No se hicieron push, merge ni rebase. El PR de estos incrementos debe comparar cada tarea con su rama padre para revisar solo su diferencia; antes de integrarlos hacia develop se deben revisar las dependencias previas, disponer de la base aislada y resolver los resultados de integración. No se presenta una reserva persistida ni una pantalla funcional.

## BOOK-01 T2 — base actualizada en la carpeta original

Fecha: 25 de octubre de 2026. Rama feature/BOOK-01-T2-actualiza-base-reservas, creada desde origin/develop 67ee38d947058be53e17a0479f4404b1d3c42bf6. Se trasladaron con cherry-pick -x los dos commits documentales y los siete incrementos de código, conservando autoría y referencias de origen. Se conservaron ambas notas históricas cuando coincidían sus posiciones en las specs BOOK-04/05/06 y en este registro; no hubo conflictos de código.

Las ramas anteriores siguen en sus commits originales; feature/BOOK-04-T1d-pasajeros-seleccion conserva f62742d y la rama del PR #12 conserva c98db4d. Los archivos de código y pruebas de bookings son idénticos a los de f62742d. No hay diferencias de código ajeno, migraciones, dependencias o pruebas ajenas respecto de la nueva base. No se ejecutaron merge, rebase, push ni tags.

Validación real: lint aprobado; 470 pruebas unitarias aprobadas en 34 suites. npm test completo fallido: 4 pruebas HTTP aprobadas y 103 de integración fallidas porque no hay DATABASE_URL/base PostgreSQL de pruebas disponible en esta ejecución. Se eliminó DATABASE_URL solo del entorno temporal de la ejecución para no utilizar una base existente. No se leyeron archivos .env ni se cambiaron las pruebas.

Formato global fallido en 26 archivos ya presentes e idénticos a origin/develop, ajenos a reservas; formato del código y pruebas de bookings aprobado. No se reformatea código del equipo incidentalmente.

Docker Desktop está instalado; se intentó iniciarlo en segundo plano. El motor sigue ausente y com.docker.service está detenido. Se solicitó a Leslie abrir Docker Desktop e informar el estado del motor. No se creó, limpió ni conectó ninguna base existente. El Compose de pruebas del equipo ya define busesuta_test en localhost:55433, con almacenamiento efímero y credenciales exclusivas de pruebas; se utilizará cuando el motor esté disponible.

PabloToapanta aprobó el PR documental #12 sobre c98db4d el 25 de octubre. El PR sigue siendo independiente de esta rama. Se recomienda integrar la documentación conforme a las comprobaciones de GitHub; esta preparación no ejecuta ese merge ni declara aprobados los incrementos de código.

Se revisaron las APIs reales y se añadió el estado actual en reservas-contratos.md. Aún faltan viaje comercializable y plantilla de asientos; no se puede acreditar una reserva persistida ni la compra completa.

## BOOK-01 T2 — verificación con PostgreSQL operativo

Fecha: 25 de octubre de 2026. Leslie abrió Docker Desktop; el motor respondió correctamente. Se comprobó que el puerto 55433 estaba libre y se creó el proyecto Compose exclusivo busesuta-leslie-tests mediante docker-compose.test.yml. Antes de ejecutar la suite se verificaron la base busesuta_test, el usuario test_user y cero tablas de aplicación. No se usaron los contenedores de otros proyectos.

La URL del contenedor se configuró únicamente para la ejecución; no se leyeron ni editaron archivos .env. npm run lint aprobado. npm test completo aprobado: 470 pruebas unitarias en 34 suites y 107 de integración en 12 suites; 577 pruebas aprobadas, sin fallos. Las migraciones y recorridos de integración se verificaron contra PostgreSQL 16.13 del contenedor nuevo. No se cambiaron pruebas, código, migraciones ni dependencias para obtener este resultado.

Esta ejecución sustituye la limitación de PostgreSQL de la ejecución anterior, cuyo resultado histórico se conserva. El formato global sigue pendiente por los 26 archivos preexistentes ya identificados; el formato de bookings está aprobado. Las 577 pruebas no incluyen un flujo de compra de reservas de extremo a extremo, todavía no implementado.

Al terminar se detiene y elimina únicamente el proyecto Compose temporal busesuta-leslie-tests; su almacenamiento es efímero. Para repetir la comprobación: docker compose -p busesuta-leslie-tests -f docker-compose.test.yml up -d --wait; configurar la URL de pruebas del proyecto en la terminal y ejecutar npm test desde backend. Consultar docs/testing-database.md. No se publicó la rama ni se integró el PR #12.
