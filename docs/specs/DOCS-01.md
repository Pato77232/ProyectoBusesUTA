# DOCS-01 — documentación general coherente con el repositorio

David solicita actualizar README, CONTRIBUTING, licencia y guías relacionadas el 4 de noviembre de 2026. Rama creada por él: `feature/DOCS-01-actualiza-documentacion-general`; base local `64f39cd`, árbol inicialmente limpio. No se consultó remoto.

## Alcance

Actualizar instrucciones, stack, estructura, enlaces, estado funcional y proceso de contribución con evidencia del checkout. Reorganizar frontend/README y corregir referencias obsoletas en GUIA-INTEGRACION. Mantener LICENSE íntegro y la declaración existente GPL-3.0-only de backend/package.json, retirando del README el aviso contradictorio de versiones posteriores y autores ficticios. No atribuir titularidad legal, apellidos, cuentas, comité, protecciones remotas, fechas de respuesta o aprobaciones no confirmadas. No crear políticas de seguridad/convivencia, citas ni versiones ficticias para completar enlaces.

Fuentes: AGENTS.md, reglas de negocio, arquitectura, convenciones, calidad, acuerdos del equipo, flujo de Codex, protocolo de errores inducidos; package.json/Dockerfiles/Compose/scripts y specs vigentes. Aplicación de guia-proyecto. Cambio documental: no modifica producto, pruebas, dependencias, infraestructura, licencia ni decisiones funcionales.

## Aceptación y comprobación

- README con identidad transViaje, stack real, inicio temporal diferenciado del persistente, migraciones y administrador sin contraseñas predeterminadas, pruebas aisladas y documentación existente.
- CONTRIBUTING con comandos desde carpetas reales, specs/commits/PR/revisión humana y distinción entre proceso acordado y propuestas; sin prometer Husky, CI o CCB configurados.
- Frontend con inventario actual de páginas y límites, sin confundir pantalla presente con compra completa habilitada.
- Enlaces relativos y ejemplos de scripts contrastados; diff completo revisado, LICENSE intacto. No leer `.env` ni arrancar entornos contra datos existentes. Al ser solo documentación, comprobaciones estáticas; no reutilizar resultados históricos como pruebas ejecutadas aquí.
- Actualizar estado y proponer commit y PR; no ejecutar commit/push/merge.

## Evidencia

Actualizados README.md, CONTRIBUTING.md, frontend/README.md y referencias puntuales de frontend/GUIA-INTEGRACION.md. Eliminadas instrucciones de Prisma/EJS/servicio app, promesas de hooks y documentos inexistentes, equipo ficticio y aviso de licencia contradictorio. Arranque temporal diferenciado de Compose persistente, migración manual, HTTPS de producción y pruebas aisladas documentados.

Comprobación estática del 4 de noviembre de 2026: enlaces relativos de los documentos del cambio resueltos; rutas de pantallas, scripts npm, manifiestos, Dockerfiles y servicios Compose contrastados con archivos locales. LICENSE sin cambios; no se leyó `.env`, no se instalaron dependencias ni se ejecutaron comandos de arranque/migración/limpieza. Cambio exclusivamente documental: no se ejecutaron suites de aplicación, lint ni format:check del backend; no se trasladan resultados anteriores como validación de esta tarea. `git diff --check` y revisión final del diff realizados. Sin consulta remota, commit, push o merge. Asistencia de Codex; revisión humana e integración pendientes, no cerrada.
