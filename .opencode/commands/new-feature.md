---
description: Genera el plan de implementación para una spec (uso: /new-feature <ID-de-la-spec>)
agent: architect
---
Planifica la funcionalidad descrita en `docs/specs/$ARGUMENTS.md`.

1. Lee la spec, `docs/business-rules.md`, `docs/architecture.md` y `docs/conventions.md`.
2. Revisa el código existente del módulo afectado.
3. Si la spec está incompleta o contradice las reglas de negocio, lista las preguntas y detente.
4. Si está completa, entrega el plan con el formato definido para el arquitecto, dividido en tareas pequeñas con su commit sugerido.

No escribas código. Termina pidiendo aprobación del plan.
