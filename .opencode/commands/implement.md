---
description: Implementa una tarea del plan aprobado (uso: /implement <ID-de-la-spec> <número de tarea>)
agent: implementer
---
Implementa la tarea **$2** del plan aprobado para la spec `docs/specs/$1.md`.

Rama actual: !`git branch --show-current`
Estado del repositorio:
!`git status --short`

Sigue las reglas de tu rol: solo esta tarea, con sus pruebas, sin tocar nada fuera del alcance. Al terminar ejecuta lint y pruebas, resume los cambios y sugiere el mensaje de commit. No hagas commit.
