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
