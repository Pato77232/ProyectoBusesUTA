# FREQUENCIES-WEB-02 — verificación local, 4 de noviembre de 2026

Fuente de alcance: [spec](../../specs/FREQUENCIES-WEB-02.md). Implementación sobre `95579e2`, sin actualización remota nueva. Datos exclusivamente ficticios; el texto `<img ...>` es una entrada deliberada de QA y se representa como texto, sin ejecutar HTML.

## Resultado

Frontend: 281 pruebas aprobadas (18 nuevas), lint y Prettier de los nueve archivos propios aprobados. Navegador Chrome headless, Nginx, backend/Auth y PostgreSQL reales mediante `frontend/scripts/dev-runtime.cjs`. Imagen construida con la nueva página/CSS/módulos y sin ampliar la copia a tests/documentos. No se leyó `.env` ni se añadieron dependencias.

Recorrido reproducible aprobado con `node frontend/tests/frequencies-list-smoke.cjs` desde la raíz (Node 24; en Windows establecer BROWSER_BIN con la ruta local de Chrome; QA_OUTPUT_DIR permite escoger destino de capturas):

1. Sin sesión bloquea filtros y ofrece login; COOPERATIVE_ADMIN consulta solo su cooperativa. CUSTOMER ve permiso insuficiente; cooperativa sin frecuencias ve vacío.
2. Filtro por ACTIVE, detalle con medianoche, resolución, recorrido y valores históricos por tramo. Origen/destino/hora solo lectura. Datos de prueba HTML visibles como texto sin imágenes ni ejecución.
3. Tab desde el título de confirmación permite llegar a cancelar; Enter cancela sin PATCH. Nueva confirmación desactiva la frecuencia libre, backend confirma INACTIVE y la fila sale del filtro ACTIVE.
4. Reactivación real con respuesta deliberadamente perdida después de escritura: no se muestra éxito ni se reenvía. GET explícito recupera estado actual ACTIVE, conservando el número de PATCH.
5. Programación, tarifa y publicación reales para otra frecuencia: intento de desactivación recibe 409 por ciclo vigente, mensaje útil y estado ACTIVE conservado.
6. Red caída limpia tabla/detalle y permite recuperar por consulta. Cambio de sesión/cooperativa en la misma página limpia datos, bloquea y pide recargar. Lectura directa de frecuencia ajena responde 404.
7. No hay solicitudes a orígenes externos. Reflujo a 360/640/1280 px sin desbordamiento horizontal del documento; tabla desplazable con indicación visible. Contraste calculado de texto principal, ayuda y botón oscuro cumple al menos 4,5:1.

## Capturas inspeccionadas

- [Escritorio, viewport 1280](desktop.png).
- [Móvil, viewport 360](mobile.png).
- [Reflujo, viewport 640](reflow.png).

Inspección visual de capturas móvil/escritorio: marca, campos, mensajes, tabla, detalle, recorrido y acciones legibles. La tabla permite desplazamiento horizontal interno; el documento no lo requiere. El viewport 640 comprueba reflujo, no certifica zoom nativo del navegador al 200 %. Zoom nativo, lector de pantalla y revisión humana siguen pendientes; no se declara conformidad de accesibilidad completa.

La primera ejecución del smoke se detuvo en cancelación por teclado porque el harness omitía el carácter de Enter. Se corrigió únicamente la pulsación completa (`text`/`unmodifiedText`), como en los smokes existentes, conservando la aserción de foco, cancelación y cero PATCH. La repetición y el recorrido final con indicación móvil/contraste aprobaron. No cambió producto para satisfacer ese fallo de QA.

Backend, sin cambios de producto en esta tarea: lint aprobado; formato global conserva 36 archivos previos. `npm test`: 1897 unitarias aprobadas/9 fallidas, 98 suites aprobadas/4 fallidas; no alcanza integración por encadenamiento. Integración por separado: 609 aprobadas/21 fallidas, 48 suites aprobadas/6 fallidas, 274,208 s. Son los contratos históricos/migraciones/arranque y timeout de fotos ya documentados en BOOK-03-L03-T1; ahora se incluye también su prueba adicional de actualización histórica, aprobada. No se modificaron pruebas previas, expectativas ni timeouts. Los resultados globales siguen fallidos.

Proyectos temporales del navegador y base exclusiva backend retirados al terminar; imágenes locales quedan en caché. Sin commit, publicación, aprobación humana ni integración acreditados. Asistencia de Codex en implementación y QA.
