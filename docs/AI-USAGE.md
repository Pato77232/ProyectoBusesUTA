# Uso de IA en el proyecto

El docente autorizó el uso de IA. Las personas responden por el código y las decisiones que entregan.

## Herramienta y transición

Codex es la herramienta principal a partir del cambio [INFRA-04](specs/INFRA-04.md), autorizado por el solicitante el 25 de octubre de 2026; revisión humana del PR e integración pendientes. El motivo reportado es la lentitud y los obstáculos encontrados con OpenCode; no se ha medido una comparación de rendimiento.

OpenCode se utilizó anteriormente. Se conserva `opencode.json` y `.opencode/` como legado identificado, sin cambiar las evidencias históricas. Los comandos `/new-feature`, `/implement`, `/review`, `/commit` y `/pr` de esos archivos no son comandos instalados en Codex.

Codex usa AGENTS.md y la skill versionada `.agents/skills/guia-proyecto/SKILL.md`. Los pasos y ejemplos están en [flujo-codex.md](flujo-codex.md); la distribución y decisiones compartidas, en [equipo-y-acuerdos.md](equipo-y-acuerdos.md). El registro de [estado](estado-proyecto.md) es una fotografía contrastable, no un monitor automático.

Las skills y los roles describen procedimientos, no controles técnicos de acceso. Cada integrante comprueba las instrucciones cargadas y las restricciones de su instalación. No importar `opencode.json` como si configurara Codex ni desactivar el sandbox para reproducir el flujo. No se cambia la configuración global de las personas en esta migración.

## Principios

1. **La IA propone, el equipo decide.** Codex explica conceptos y alternativas; no inventa reglas, aprobaciones ni consenso.
2. **Spec primero.** Una tarea pequeña con responsable, revisor, dependencias y criterios. Un candidato del registro aún sin spec no autoriza implementar.
3. **Guía para aprender.** Explicar qué hacer, por qué, conceptos mínimos, siguiente paso y cómo comprobarlo, considerando poca experiencia en backend/frontend.
4. **Estado con evidencia.** Consultar Git y specs antes de orientar por nombre. Distinguir propuesta, trabajo local, integración y cierre; declarar información desactualizada o no accesible.
5. **Calidad.** Aplicar SOLID y criterios observables de usabilidad según [calidad.md](calidad.md), sin refactorizaciones ajenas a la tarea.
6. **Revisión humana.** Otro integrante verifica el cambio. Una revisión de IA no es aprobación del PR.
7. **Git controlado.** Codex solo hace commits con petición humana explícita; no ejecuta push, merge, rebase, tags ni cambia a main/develop. Conserva trabajo ajeno y la identidad Git configurada.
8. **Resultados reales.** No debilitar pruebas ni editar migraciones existentes; separar fallos inducidos autorizados, inesperados y limitaciones del entorno. No guardar secretos ni datos reales en prompts o evidencias.

## Trazabilidad sin Jira

`Spec → decisión humana → rama por tarea → cambio y pruebas → commits atómicos → PR → revisión humana → integración → verificación y cierre`.

La spec guarda acuerdos y resultados; el registro resume responsable, dependencias y próxima acción. Incluir `Refs: docs/specs/<ID>.md` en los commits. Los PR indican la herramienta realmente usada; el pie opcional `Asistido-por: Codex` identifica cambios nuevos asistidos por Codex. Mantener `Asistido-por: OpenCode` donde describa trabajo histórico.

Registrar decisiones relevantes con participantes, fecha y confirmación; no es necesario copiar chats completos. El chat privado no debe ser la única evidencia. No publicar una conversación con datos sensibles para justificar una decisión.

## Primera revisión

El 4 de noviembre de 2026 se entrega una versión funcional en main con los errores inducidos expresamente autorizados según [errores-inducidos.md](errores-inducidos.md). No inventarlos, corregirlos incidentalmente ni ocultar fallos. Jira o GitHub Issues se decidirá después de esa revisión; hasta entonces usar specs locales. Versiones solo MAJOR.MINOR.PATCH y commits atómicos con tipo en inglés, alcance y descripción en español.

## Fuentes de configuración consultadas

- [Instrucciones de Codex con AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
- [Skills y descubrimiento local en .agents/skills](https://learn.chatgpt.com/docs/build-skills).

La validación del archivo de una skill no demuestra su carga ni su comportamiento en todas las instalaciones. Comprobar una sesión nueva y los ejemplos de la guía al adoptar el flujo en cada equipo.
