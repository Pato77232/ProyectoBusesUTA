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
