# ROUTE-SHEETS-WEB-03 — publicación y renovación web (2.3)

David solicita implementar 2.3 y preparar texto de PR el 4 de noviembre de 2026. Base local comprobada `7fff386`, árbol limpio, misma rama `feature/ROUTE-SHEETS-10-consulta-ocupaciones`; sin consulta remota ni aprobación humana de código inferida.

## Contrato y alcance

Fuentes: [reglas RN-02/20–23/30–32/43](../business-rules.md), [arquitectura](../architecture.md), [convenciones](../conventions.md), [calidad](../calidad.md), [protocolo académico](../errores-inducidos.md), ROUTE-SHEETS-05/06/07/08 y WEB-02. Adopta [DESIGN.md](../../frontend/DESIGN.md): misma página, marca, Bootstrap y tokens locales, sin dependencias ni navegación global nuevas. No introduce defectos académicos.

Dos acciones explícitas en el editor: publicar un borrador guardado y preparar siguiente ciclo desde una hoja publicada. No actuar con cambios locales, programación/tarifa incompletas, revisión/conflicto/operación pendiente o sesión no verificable. Mostrar resumen de grupo, período local UTC−05, servicios, agendas, precios y porcentajes guardados antes de confirmar. Renovación muestra período siguiente contiguo como previsión, con fechas definitivas derivadas por servidor; preparar no publica ni amplía ventas.

Publicar usa POST /:id/publish con expectedRevision tarifaria y expectedProgrammingRevision leídas, sin tenant, actor ni seriesId elegidos por cliente. Reconsultar ambas versiones antes del POST; el servidor revalida bajo bloqueo. Confirmar resultado mediante GET propio, estado PUBLISHED y mismas revisiones/contenido. Una respuesta perdida bloquea escrituras y ofrece consulta de estado sin reenviar publicación. Si continúa DRAFT, exige otra revisión explícita.

Renovar usa POST /:id/renewals con expectedProgrammingRevision, expectedTariffRevision y requestKey UUID nueva por intención confirmada. Antes del envío registrar intención mínima en sessionStorage por actor/cooperativa/hoja; ante respuesta perdida conservar exactamente clave/cuerpo y ofrecer recuperación explícita por el mismo POST idempotente, nunca generar otra clave ni reintentar automáticamente. Verificar DTO de procedencia/período y consultar destino propio antes de mostrar enlace al editor. No copiar programación en navegador ni tocar historia/inventario/reservas. Origen intermedio, cupo de dos ciclos, frecuencia inactiva y compromisos se rechazan con mensaje del servidor. El servidor conserva su autoridad.

Pendientes se recuperan en la misma pestaña al recargar, antes de permitir otra intención; si falla el almacenamiento, no enviar. Cambiar identidad limpia DOM y bloquea acciones. Deshabilitar doble clic y edición durante envío/revisión/resultado incierto. No almacenar contraseñas, tokens ni datos de pasajeros. Al recuperar renovación no atribuir estado DRAFT actual sin consulta; enlazar el destino verificado incluso si ya se publicó. Cerrar pestaña/borrar almacenamiento pierde la ayuda local de recuperación: no prometer persistencia entre dispositivos.

Separar orquestación de ciclo, validación/persistencia de intención y renderizado, reutilizando sesión/API/CSRF/editor; sin cambios de negocio backend, migraciones ni dependencias. No sustituir confirmación humana, publicar automáticamente, usar generate-cycles/purchase-window legado ni implementar Chofer/Controlador.

## Aceptación y verificación

- Publicar revisiones guardadas mediante revisión cancelable; conflicto o datos incompletos no envían POST, respuesta perdida se consulta sin duplicar viajes.
- Renovar crea borrador contiguo con vínculo/identidades nuevos y tarifas copiadas; abre editor, consulta no publica; doble clic y recuperación mantienen una clave. Publicar destino exige otra confirmación.
- Aislamiento, rol y cambio de sesión comprobados antes/después; errores conservan contexto útil sin habilitar escrituras ambiguas.
- Unitarias de estados/revisiones/DTO/almacenamiento y recuperación; navegador con servidor/imagen/PG reales para publicar, renovar, respuesta perdida, límite y conservación del origen. Teclado, contraste y viewport 360/640/1280; declarar zoom nativo/lector pendientes si no se verifican.
- Ejecutar frontend lint/tests y backend lint, format:check y npm test con PostgreSQL aislado, conservando pruebas anteriores; revisar diff y retirar entorno propio. Registrar resultados reales; sin commit/push/PR remota.

## Evidencia

Implementación local completada el 4 de noviembre de 2026 sobre `7fff386`, en la misma rama. Orquestación y almacenamiento/validación separados; editor existente comparte sesión, bloqueo de operación, resumen, foco y API/CSRF. No hay cambios backend, migraciones ni dependencias nuevas en este incremento.

Frontend lint y **316/316 pruebas aprobadas**, **18 nuevas**. QA con servidor/imagen/Chrome/PostgreSQL reales: publicación con versiones explícitas; renovación contigua con copia de tarifas/IDs nuevos; pérdidas después de escritura y recuperación tras recarga sin repetir publicación ni cambiar clave de renovación; navegación y publicación explícita del destino; rechazo del tercer período; origen intacto y aislamiento. Cancelación por Tab/Enter, contraste y reflujo comprobados. Capturas y reproducción en [evidencia](../evidence/ROUTE-SHEETS-WEB-03/README.md).

Backend: lint aprobado; `npm test` ejecutado y detenido por **9 fallos unitarios históricos, 1902 aprobadas**. Integración ejecutada por separado: **613 aprobadas/21 fallidas** (contratos históricos y timeout de fotos). Pruebas previas intactas conforme a la decisión de David; no se presenta CI verde ni fallos académicos autorizados. Formato propio y diff aprobados, formato global conserva **36 archivos previos** pendientes. Los intentos intermedios de QA fallidos y la corrección del inyector de pérdidas del nuevo script se declaran en evidencia; ejecución completa posterior aprobada.

Entornos propios retirados. Zoom nativo al 200 %, lector de pantalla y revisión humana pendientes. Asistencia de Codex; no integrada/cerrada ni revisada por una persona. Sin commit, push o PR remota. Preparar texto de PR no equivale a publicarlo.
