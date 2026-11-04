---
description: Sugiere el mensaje de commit para los cambios en staging
---
Propón el mensaje de commit para los cambios en staging. **No ejecutes `git commit`.**

Rama actual: !`git branch --show-current`

Archivos en staging:
!`git diff --staged --stat`

Cambios en staging:
!`git diff --staged`

Reglas (ver `docs/conventions.md`):
- Formato: `tipo(alcance): descripción`.
- Tipo en inglés: feat, fix, docs, refactor, test, chore, ci, build.
- Alcance en español (módulo afectado) y descripción en español, con **verbo en imperativo** (agrega, corrige, implementa...), minúscula inicial, sin punto final, máximo 72 caracteres.
- Agrega en el pie `Refs: docs/specs/<ID>.md` cuando la spec esté identificada. Jira o GitHub Issues se elegirá después del 4 de noviembre de 2026: no inventes tickets ni deduzcas claves externas.
- Si hay un cambio incompatible, usa `!` o `BREAKING CHANGE:` en el pie.

Si no hay nada en staging, dilo y sugiere usar `git add -p`.
Si el cambio mezcla varios temas, **no lo aceptes como un solo commit**: propón cómo dividirlo en commits atómicos y qué archivos o fragmentos va en cada uno, con su mensaje.
Entrega el mensaje listo para copiar.
