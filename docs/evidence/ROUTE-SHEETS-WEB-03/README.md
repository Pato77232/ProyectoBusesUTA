# Publicación y renovación web — evidencia local

4 de noviembre de 2026, base `7fff386`, rama `feature/ROUTE-SHEETS-10-consulta-ocupaciones`. Asistencia de Codex; sin commit, integración o revisión humana de este incremento.

## Reproducción

Desde la raíz: `node frontend/tests/route-sheet-lifecycle-smoke.cjs`, con Docker activo y `BROWSER_BIN` apuntando a Chrome. `QA_OUTPUT_DIR` elige destino de capturas. Crea imagen, base, cooperativas y credenciales ficticias exclusivas; retira los contenedores y perfil al finalizar. No lee `.env`. Para suites de backend seguir [testing-database.md](../../testing-database.md).

El navegador configura dos buses, dos servicios con parada tras medianoche, traslados, descanso/mantenimiento y precios por par. Cancela la revisión de publicación con Tab/Enter sin POST; publica con revisiones explícitas y pierde intencionalmente la respuesta después de escribir. Tras recargar, comprueba PUBLISHED mediante GET sin reenviar publicación.

Prepara siguiente ciclo y pierde su respuesta después de escribir. Tras recargar, recupera el mismo borrador con exactamente el mismo cuerpo/requestKey, verifica período contiguo, IDs nuevos, precios copiados y origen intacto. Abre el destino en el editor, lo publica explícitamente y comprueba rechazo del tercer período no terminado sin alterar hojas anteriores. Cambiar identidad antes de confirmar bloquea la acción y limpia el contexto; identidad ajena recibe 404.

El inyector de pérdidas debe instalarse antes de crear el cliente API de la página (que conserva su referencia a fetch). Un primer intento de QA no simulaba la pérdida en ese cliente; se corrigió solo el nuevo instrumento de QA. Otras repeticiones intermedias se detuvieron sin completar el escenario; al añadir etapas se localizó el bloqueo al recargar operaciones pendientes con el aviso nativo de salida activo. El script ahora confirma ese diálogo, como una persona al salir, sin retirar la protección del producto. La ejecución final completa aprobó; los intentos intermedios no se contabilizan como aprobados.

## Resultados y límites

- Frontend **316/316** aprobadas, incluidas **18 nuevas**, lint aprobado. Validan revisiones, confirmación/cancelación, doble envío, sesión, almacenamiento fallido/alterado, DTO ajeno, recuperación tras recarga y fallo de consulta posterior a un POST aceptado.
- Backend sin cambios de producto en 2.3: lint aprobado. `npm test` se detiene en las unitarias: **1902 aprobadas/9 fallidas**. Integración ejecutada por separado: **613 aprobadas/21 fallidas**. Son contratos históricos de composición/proveedores, catálogos de migraciones y timeout de fotos conservados; no son defectos académicos autorizados ni una suite verde. El deadlock adicional observado en 2.2 no apareció en esta ejecución.
- Formato propio y diff comprobados; formato global backend conserva **36 archivos previos** pendientes.
- QA de navegador/servidor/imagen/PostgreSQL aprobado; teclado y contraste >=4.5 para texto, nota y botón de confirmación; viewport 360/640/1280 sin desbordamiento horizontal. Capturas: [escritorio](desktop.png), [móvil](mobile.png), [reflujo](reflow.png).
- Zoom nativo al 200 %, lector de pantalla y revisión humana pendientes. Reflujo no los sustituye. Recuperación local limitada a la misma pestaña y almacenamiento disponible; cerrar/borrar pierde esa ayuda. El backend conserva la unicidad de renovación.

Spec: [ROUTE-SHEETS-WEB-03](../../specs/ROUTE-SHEETS-WEB-03.md). No se añadieron dependencias, migraciones, generación automática ni funciones del Chofer/Controlador.
