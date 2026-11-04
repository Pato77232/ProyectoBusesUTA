# Evidencia del editor de programación y tarifas

4 de noviembre de 2026. Base `cc7d4c5`, cambios locales en `feature/ROUTE-SHEETS-10-consulta-ocupaciones`. No acredita integración ni revisión humana.

Ejecutar `node frontend/tests/route-sheet-editor-smoke.cjs` desde la raíz, con Docker disponible y `BROWSER_BIN` apuntando a Chrome. `QA_OUTPUT_DIR` selecciona el directorio de capturas. El script crea credenciales aleatorias y contenedores exclusivos, usa migraciones reales y retira su entorno en finally; no consulta `.env` del proyecto. No usar una base compartida para las integraciones; seguir `docs/testing-database.md`.

La ejecución final aprobó programación de dos buses/dos servicios, paradas después de medianoche, traslados, descansos/mantenimiento, revisión y guardado independiente de tarifas explícitas por par. También comprobó identidades, conflicto concurrente, respuestas perdidas después de escritura sin reenviar PUT, rechazo de solapamientos, lectura de publicadas, sesión/rol/cooperativa y ausencia de solicitudes a otros orígenes. Cancelación con Tab/Enter sin escritura y contraste de texto, nota y botón >=4.5 aprobados.

Capturas con datos ficticios, antes de publicar la hoja de QA:

- [Escritorio, 1280 px](desktop.png).
- [Móvil, 360 px](mobile.png).
- [Reflujo, 640 px](reflow.png).

Sin desbordamiento horizontal en esas anchuras. Zoom nativo al 200 %, lector de pantalla y revisión humana pendientes. Las capturas y las comprobaciones automáticas no sustituyen esos controles.

Resultados completos y fallos conservados: [spec, sección 6](../../specs/ROUTE-SHEETS-WEB-02.md). Frontend 298/298; nuevas pruebas backend 9/9; regresión backend 1902 aprobadas/9 fallidas en unitarias y 612 aprobadas/22 fallidas en integración. El deadlock adicional de desactivación no se repitió al ejecutar ese archivo por separado (7/7); la ejecución global conserva su resultado original.
