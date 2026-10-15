# Uso de IA en el proyecto

El docente autorizó el uso de IA en este proyecto. Este documento deja constancia de cómo la usamos.

## Herramienta
OpenCode (agente de IA en terminal), configurado en el repositorio: `AGENTS.md`, `opencode.json`, `.opencode/agents/` y `.opencode/commands/`.

## Principios
1. **La IA propone, el equipo decide.** Quien commitea es responsable de lo que entra y debe poder explicarlo.
2. **Spec primero.** Cada funcionalidad parte de una spec en `docs/specs/`. La IA no inventa requisitos.
3. **Tareas pequeñas, sesiones cortas.** Una sesión por tarea.
4. **Revisión humana siempre.** Se revisa el diff completo, y se ejecutan lint y pruebas antes de commitear.
5. **La IA no toca el flujo de Git.** No hace push, merge, rebase ni tags; los commits los hacen las personas.
6. **La IA no debilita las pruebas** ni edita migraciones existentes.

## Flujo
`Issue → spec → /new-feature (plan) → aprobación humana → /implement (tarea por tarea) → lint + pruebas → /review → commits atómicos (/commit sugiere el mensaje) → PR (/pr redacta la descripción) → revisión por otro integrante`

## Agentes y comandos
| Elemento | Para qué sirve |
|---|---|
| `architect` | Planifica por capas. No escribe código |
| `implementer` | Implementa una tarea del plan con pruebas |
| `reviewer` | Revisa contra reglas de negocio, arquitectura y convenciones (solo lectura) |
| `tester` | Escribe pruebas (no toca código de producción) |
| `/new-feature <ID>` | Genera el plan a partir de una spec |
| `/implement <ID> <n>` | Implementa la tarea n del plan |
| `/commit` | Sugiere el mensaje de commit de lo que está en staging |
| `/review` | Revisión previa al PR |
| `/pr <n>` | Redacta la descripción del PR |

## Trazabilidad
- Los PR indican si hubo asistencia de IA.
- Opcionalmente, los commits asistidos llevan el pie `Asistido-por: OpenCode`.
- Los prompts relevantes o decisiones importantes pueden documentarse en la spec o en un ADR.
