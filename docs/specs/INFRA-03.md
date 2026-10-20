# INFRA-03: Sincronización del lockfile de dependencias opcionales

- **ID local:** INFRA-03
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** infra
- **Responsable:** Shirley
- **Revisor:** Pablo
- **Estado:** Borrador (pendiente de revisión por Pablo)

> Cambio **propuesto** (pendiente de revisión por Pablo). Esta spec es de infraestructura de desarrollo; no agrega reglas de negocio ni modifica módulos de negocio.

## 1. Objetivo

Sincronizar `backend/package-lock.json` con las dependencias opcionales requeridas por `unrs-resolver`, que llega al proyecto mediante `jest-resolve`, para que `npm ci` pueda instalar el backend sin errores de consistencia del lockfile.

## 2. Reglas de negocio involucradas

- Ninguna directamente. Esta spec es de infraestructura de desarrollo y no toca reglas de negocio (RN-xx).

## 3. Alcance

**Incluye:**
- Regenerar únicamente `backend/package-lock.json` mediante `npm install --package-lock-only`.
- Registrar las entradas de `@emnapi/core` y `@emnapi/runtime` en versión `1.11.3`.
- Registrar las copias anidadas en versión `1.10.0` bajo `@unrs/resolver-binding-wasm32-wasi`.
- Actualizar `@emnapi/wasi-threads` de `1.2.1` a `1.2.3` y ajustar los metadatos `peer` correspondientes.

**No incluye:**
- Modificar `backend/package.json` ni versiones de dependencias directas.
- Modificar código de módulos, pruebas, migraciones u otros archivos.
- Agregar dependencias directas.
- Ejecutar `prettier --write`.

## 4. Decisiones propuestas (pendiente de revisión por Pablo)

| Tema | Decisión |
|------|----------|
| Archivo a regenerar | Solo `backend/package-lock.json` mediante `npm install --package-lock-only` |
| Dependencias opcionales | Incluir `@emnapi/core` y `@emnapi/runtime` `1.11.3`, junto con sus copias anidadas `1.10.0` bajo `@unrs/resolver-binding-wasm32-wasi` |
| `@emnapi/wasi-threads` | Actualizar de `1.2.1` a `1.2.3` para satisfacer la versión requerida por el árbol de dependencias |
| Dependencias directas | No cambiar `package.json` ni las versiones directas |
| Responsable / Revisor | Shirley / Pablo |

## 5. Tareas (pequeñas, una por entrega)

### T1 — Sincronizar el lockfile *(propuesta pendiente de revisión)*

- `backend/package-lock.json`: regenerar solo el lockfile con `npm install --package-lock-only`.
- Confirmar que el cambio conserva `backend/package.json` y las versiones de dependencias directas.
- **Verificación esperada de T1:** `npm ci --dry-run` y `npm ci` terminan sin error; `npm test` pasa las suites unitarias y de integración.

## 6. Endpoints

| Método | Ruta | Roles | Respuestas |
|--------|------|-------|------------|
| Ninguno | N/A | N/A | N/A (infraestructura de desarrollo) |

## 7. Criterios de aceptación

- [ ] La causa del error queda documentada: el commit `0b2fcc4` (PR #5, INFRA-02) dejó `backend/package-lock.json` sin `@emnapi/core` ni `@emnapi/runtime`, dependencias opcionales de `unrs-resolver` que llega por `jest-resolve`.
- [ ] El lockfile representa la dependencia requerida `@emnapi/wasi-threads@1.2.3` y contiene `@emnapi/core` y `@emnapi/runtime`, incluidas las copias anidadas indicadas.
- [ ] El cambio se limita a `backend/package-lock.json`.
- [ ] `backend/package.json` y las versiones de dependencias directas no cambian.
- [ ] `npm ci --dry-run` y `npm ci` terminan sin error.
- [ ] `npm test` aprueba 45 pruebas unitarias y 44 pruebas de integración.
- [ ] No se modifica código de módulos ni se ejecuta `prettier --write`.

## 8. Casos borde y errores

- Lockfile desincronizado: `npm ci` informa que `@emnapi/wasi-threads@1.2.1` no satisface la versión `1.2.3` requerida y señala la ausencia de `@emnapi/core` y `@emnapi/runtime`.
- Instalación en Windows: al regenerar el lockfile debe preservarse la información de dependencias opcionales necesaria para instalaciones limpias en otros entornos.
- Versiones directas: cualquier cambio en `backend/package.json` o en versiones de dependencias directas queda fuera del alcance de esta spec.

## 9. Verificación realizada

- `npm ci --dry-run`: terminó sin error.
- `npm ci`: terminó correctamente con una instalación limpia.
- `npm test`: aprobaron 45 pruebas unitarias y 44 pruebas de integración.

## 10. Preguntas abiertas

- Ninguna por el momento. La propuesta queda pendiente de revisión por Pablo.

## 11. Defecto inducido (solo si aplica)

**No aplica.** INFRA-03 no introduce defectos académicos ni vulnerabilidades intencionales.

## Precisiones de verificación

- El problema se atribuye al cambio del lockfile incluido en el commit `0b2fcc4` (PR #5, INFRA-02), que quitó las entradas de `@emnapi/core` y `@emnapi/runtime`.
- `unrs-resolver` llega como dependencia transitiva de `jest-resolve`; las dependencias `@emnapi` afectadas son opcionales.
- La regeneración propuesta actualiza `@emnapi/wasi-threads` y ajusta metadatos `peer`, además de agregar las entradas indicadas.

## Cierre de infraestructura

Pendiente de revisión por Pablo. Verificaciones reportadas: `npm ci --dry-run`, `npm ci` limpio y `npm test` con 45 pruebas unitarias y 44 de integración aprobadas. Sin defectos inducidos.
