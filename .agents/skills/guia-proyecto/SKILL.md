---
name: guia-proyecto
description: Orienta a integrantes de ProyectoBusesUTA por nombre, contrasta tareas y dependencias, facilita acuerdos y aplica el flujo de planificación, implementación, pruebas y revisión del repositorio. Usar al pedir qué hacer ahora o cómo realizar una tarea del equipo.
---

# Guía de ProyectoBusesUTA

## Elegir el contexto pertinente

Lee AGENTS.md de la raíz. Para orientación por nombre consulta [estado-proyecto.md](../../../docs/estado-proyecto.md) y [equipo-y-acuerdos.md](../../../docs/equipo-y-acuerdos.md). Para planificar, implementar, probar o revisar lee solo el procedimiento pertinente de [flujo-codex.md](../../../docs/flujo-codex.md), la spec y sus referencias. Los criterios SOLID/usabilidad están en [calidad.md](../../../docs/calidad.md).

## Orientar sin inventar progreso

- Comprueba rama, cambios locales y fecha/commit de la base. Si está permitido, actualiza origin/develop con fetch sin cambiar a develop; si no, declara la limitación. Contrasta la fila con la spec y código; revisa ramas/PR accesibles antes de proponer rehacer trabajo.
- Usa el nombre para buscar la responsabilidad documentada, no como autenticación ni autorización Git. Si no coincide con el registro, pide aclararlo.
- Recomienda la siguiente tarea aprobada con dependencias resueltas. Si solo hay propuestas, recomienda redactar su spec o resolver el acuerdo; no implementes negocio todavía. Respeta el trabajo actual autorizado y no lo reemplaces por otra prioridad por iniciativa propia.
- Explica brevemente: estado observado, siguiente resultado pequeño y su motivo, conceptos mínimos, primeros pasos, acuerdos necesarios y comprobación. Da un ejemplo concreto cuando ayude a aprender, sin introducir reglas funcionales nuevas.
- Las propuestas de responsable/revisor/comité no son aceptación de esas personas. No marques una tarea integrada por existir código ni cerrada por pasar pruebas locales.

## Facilitar decisiones y trabajar por rol

Para un acuerdo pendiente identifica afectados, pregunta concreta, alternativas, recomendación, impacto en contrato/pruebas y trabajo independiente posible. Prepara un mensaje para que la persona lo comparta; no envíes mensajes ni tomes el silencio como aprobación. Registra solo decisiones humanas confirmadas según la plantilla del protocolo.

En planificación no escribas producto. En implementación limita el cambio a la tarea autorizada. En pruebas no modifiques producción ni debilites expectativas. En revisión mantente en solo lectura y reporta hallazgos verificables; no sustituyas la aprobación humana. Ningún rol implica delegación automática ni permisos adicionales.

Al completar trabajo autorizado actualiza la spec y la fila pertinente con evidencia real, separando limitaciones y defectos. Usa Conventional Commits con referencia local. No ejecutes commits sin petición explícita, ni push, merge, rebase, tags o cambios a main/develop. La skill no configura el sandbox ni convierte permisos de OpenCode a Codex.
