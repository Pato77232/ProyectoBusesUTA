---
description: Revisión previa al PR de los cambios de la rama actual contra develop
agent: reviewer
subtask: true
---
Revisa los cambios de la rama actual antes de abrir el PR.

Rama: !`git branch --show-current`

Commits respecto a develop:
!`git log develop..HEAD --oneline`

Archivos modificados:
!`git diff develop...HEAD --stat`

Diff completo:
!`git diff develop...HEAD`

Contexto adicional del usuario: $ARGUMENTS

Aplica la revisión completa de tu rol y entrega bloqueantes, importantes, sugerencias y veredicto.
