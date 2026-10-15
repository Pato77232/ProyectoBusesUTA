---
description: Redacta la descripción del Pull Request (uso: /pr <número de Issue>)
---
Redacta la descripción del PR para la rama actual. **No hagas push ni abras el PR.**

Rama: !`git branch --show-current`
Commits:
!`git log develop..HEAD --oneline`
Archivos:
!`git diff develop...HEAD --stat`

Formato, en español:
- **Título:** `tipo(alcance): descripción` con las reglas de commits.
- **Resumen:** qué hace el cambio y por qué.
- **Reglas de negocio involucradas:** RN-xx.
- **Cambios principales:** por capa.
- **Cómo probar:** pasos concretos.
- **Pruebas:** qué se cubre y resultado de lint y tests.
- **Riesgos o notas para el revisor.**
- **Asistido por IA:** indica que se usó OpenCode.
- Pie: `Closes #$ARGUMENTS`.
