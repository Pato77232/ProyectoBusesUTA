# Guía de contribución

Gracias por colaborar. Este documento define **cómo trabajamos todos** para que el historial del repositorio sea ordenado, trazable y auditable. Es de lectura obligatoria para cada integrante antes de su primer commit.

## 📑 Contenido

1. [Principios](#1-principios)
2. [Herramientas y configuración inicial](#2-herramientas-y-configuración-inicial)
3. [Flujo de ramas (Gitflow)](#3-flujo-de-ramas-gitflow)
4. [Nombres de ramas](#4-nombres-de-ramas)
5. [Conventional Commits](#5-conventional-commits)
6. [Versionamiento semántico](#6-versionamiento-semántico)
7. [Control de cambios (Jira + CCB)](#7-control-de-cambios-jira--ccb)
8. [Ciclo completo de un cambio](#8-ciclo-completo-de-un-cambio)
9. [Pull Requests y revisión de código](#9-pull-requests-y-revisión-de-código)
10. [Hotfix (cambios de emergencia)](#10-hotfix-cambios-de-emergencia)
11. [Proceso de release](#11-proceso-de-release)
12. [Estilo de código y pruebas](#12-estilo-de-código-y-pruebas)
13. [Uso de herramientas de IA](#13-uso-de-herramientas-de-ia)
14. [Definición de "terminado"](#14-definición-de-terminado)
15. [Reglas que nunca se rompen](#15-reglas-que-nunca-se-rompen)

---

## 1. Principios

- **Todo cambio tiene un ticket** en Jira. Sin ticket, no hay rama, commit ni PR.
- **Nadie hace push directo** a `main` ni a `develop`.
- **Todo cambio pasa por revisión** de al menos otro integrante.
- **Cada integrante trabaja en su propia copia local** y con su propia identidad de Git.
- **Lo que no está en el repositorio, no existe**: la documentación vive junto al código.

## 2. Herramientas y configuración inicial

```bash
# 1. Clonar
git clone https://github.com/ORGANIZACION/NOMBRE-DEL-PROYECTO.git
cd NOMBRE-DEL-PROYECTO

# 2. Configurar tu identidad (debe coincidir con tu cuenta de GitHub)
git config user.name  "Nombre Apellido"
git config user.email "tu-correo@ejemplo.com"

# 3. Instalar dependencias y hooks (husky + commitlint)
npm install

# 4. Entorno
cp .env.example .env
docker compose up --build
```

> Los hooks de `husky` rechazan automáticamente los commits que no cumplan la convención de la sección 5.

## 3. Flujo de ramas (Gitflow)

| Rama | Propósito | Se crea desde | Se integra en |
|---|---|---|---|
| `main` | Código estable; cada commit es una versión publicada | — | — |
| `develop` | Integración continua del trabajo del equipo | `main` | — |
| `feature/*` | Una funcionalidad o cambio aprobado | `develop` | `develop` |
| `release/*` | Preparación de una versión (ajustes finales, versión, changelog) | `develop` | `main` y `develop` |
| `hotfix/*` | Corrección urgente en producción | `main` | `main` y `develop` |

```
main     ●───────────────●──────────────●
          \             / \            /
release    \           ●   ●──────────●   (release/x.y.z)
            \         /
develop ●────●──●──●─●────●──●────────●
              \    /       \      /
feature        ●──●         ●────●
```

**Protecciones en GitHub** (configuradas por el comité): `main` y `develop` exigen PR, 1 aprobación mínima y que los checks pasen.

## 4. Nombres de ramas

Formato: `tipo/CLAVE-JIRA-descripcion-corta-en-kebab-case`

```
feature/MCS-12-busqueda-frecuencias
feature/MCS-25-seleccion-asientos
release/1.0.0
hotfix/MCS-40-fix-validacion-comprobante
```

## 5. Conventional Commits

Formato:

```
<tipo>(<alcance>): <descripción en imperativo> (CLAVE-JIRA)

[cuerpo opcional: qué y por qué]

[pie opcional: BREAKING CHANGE: ... / Refs: MCS-12]
```

### Tipos permitidos

| Tipo | Uso | Efecto en versión |
|---|---|---|
| `feat` | Nueva funcionalidad | MINOR |
| `fix` | Corrección de error | PATCH |
| `docs` | Solo documentación | — |
| `style` | Formato (sin cambio de lógica) | — |
| `refactor` | Reestructura sin cambiar comportamiento | — |
| `perf` | Mejora de rendimiento | PATCH |
| `test` | Pruebas | — |
| `build` | Docker, dependencias, scripts de build | — |
| `ci` | Workflows de GitHub Actions | — |
| `chore` | Tareas de mantenimiento | — |
| `revert` | Revierte un commit | — |

### Alcances sugeridos

`auth`, `cooperativas`, `buses`, `frecuencias`, `hojas-ruta`, `boletos`, `pagos`, `search`, `ui`, `db`, `docker`, `docs`.

### Ejemplos

```
feat(buses): agregar plantillas de asientos por carrocería (MCS-18)
fix(pagos): rechazar comprobantes mayores a 5 MB (MCS-31)
docs(readme): documentar variables de entorno (MCS-5)
refactor(boletos): extraer cálculo de descuentos a servicio (MCS-27)
feat(api)!: cambiar formato de respuesta de frecuencias (MCS-33)

BREAKING CHANGE: el campo `hora` ahora es ISO 8601.
```

### Reglas

- Una idea por commit; commits pequeños y frecuentes.
- Descripción en **minúsculas**, imperativo, sin punto final, máximo 72 caracteres.
- Siempre incluir la clave de Jira al final del asunto.
- `!` o `BREAKING CHANGE:` solo para cambios incompatibles (suben la versión MAJOR).

## 6. Versionamiento semántico

Usamos [SemVer 2.0.0](https://semver.org/lang/es/): **`MAJOR.MINOR.PATCH`**

- **MAJOR**: cambios incompatibles.
- **MINOR**: funcionalidad nueva compatible.
- **PATCH**: correcciones compatibles.

Las versiones se publican como **tags anotados** sobre `main`:

```bash
git tag -a v0.2.0 -m "Release 0.2.0: venta de boletos"
git push origin v0.2.0
```

Hasta la entrega final se usa `0.y.z` (desarrollo inicial); la entrega final es `1.0.0`. Cada release actualiza `CHANGELOG.md` (formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)).

## 7. Control de cambios (Jira + CCB)

### 7.1 Comité de control de cambios (CCB)

El CCB está formado por **2 integrantes** (ver README). Sus funciones: evaluar las peticiones de cambio, aprobarlas, rechazarlas o cancelarlas con justificación, priorizarlas y asignarlas.

### 7.2 Tipos de cambio

| Tipo | Descripción | Aprobación |
|---|---|---|
| **Normal** | Cambio planificado (nueva funcionalidad, mejora) | CCB antes de desarrollar |
| **Estándar** | Cambio repetitivo y de bajo riesgo (texto, estilo) | Preaprobado, se registra |
| **Emergencia** | Falla crítica que impide operar | Aprobación rápida de un miembro del CCB; revisión posterior del CCB completo |

### 7.3 Estados del ticket

```
Solicitado → En revisión (CCB) → Aprobado → En desarrollo → En revisión de código → Verificado → Cerrado
                    ├──────────→ Rechazado
                    └──────────→ Cancelado   (siempre con motivo de cancelación)
```

### 7.4 Campos obligatorios de una petición de cambio

Título, descripción, justificación, **tipo de cambio**, prioridad, solicitante, asignado, módulo afectado, impacto y riesgo. Si se cancela o rechaza: **motivo documentado**.

> Estos datos alimentan el dashboard de auditoría (cambios por integrante, por tipo, cancelados y de emergencia por mes).

## 8. Ciclo completo de un cambio

1. **Solicitud:** cualquier integrante crea el ticket en Jira (tipo *Change Request*).
2. **Evaluación:** el CCB lo revisa y lo aprueba, rechaza o cancela (con motivo).
3. **Asignación:** el CCB asigna responsable y prioridad.
4. **Rama:** el responsable crea `feature/CLAVE-descripcion` desde `develop` y mueve el ticket a *En desarrollo*.
   ```bash
   git switch develop && git pull
   git switch -c feature/MCS-12-busqueda-frecuencias
   ```
5. **Desarrollo:** commits pequeños siguiendo la sección 5; subir la rama con frecuencia.
6. **Pull Request** hacia `develop` con la plantilla completa; el ticket pasa a *En revisión de código*.
7. **Revisión:** otro integrante revisa (sección 9).
8. **Merge:** *squash and merge* o *merge commit* (acordado por el equipo); se elimina la rama.
9. **Verificación:** se comprueba en `develop`; el ticket pasa a *Verificado* y luego a *Cerrado*.

## 9. Pull Requests y revisión de código

**Quien abre el PR:**

- Título con formato Conventional Commit: `feat(buses): plantillas de asientos (MCS-18)`.
- Completar la plantilla: qué cambia, por qué, cómo probarlo, evidencia (capturas) y ticket relacionado.
- PR pequeño y enfocado; si supera ~400 líneas, dividirlo.
- Asegurar que `lint`, `test` y la ejecución con Docker funcionan.

**Quien revisa:**

- Responde en un máximo de 24 horas.
- Revisa lógica, legibilidad, pruebas y que cumpla el ticket.
- Comenta de forma constructiva; usa *Approve* o *Request changes*.
- **Nadie aprueba su propio PR.**

## 10. Hotfix (cambios de emergencia)

1. Crear el ticket de tipo **Emergencia** y notificar al CCB.
2. Un miembro del CCB aprueba rápido.
3. Crear la rama desde `main`:
   ```bash
   git switch main && git pull
   git switch -c hotfix/MCS-40-fix-validacion-comprobante
   ```
4. Corregir, abrir PR hacia `main` (revisión obligatoria, aunque sea rápida).
5. Tras el merge: tag de PATCH (ej. `v1.0.1`) y **merge de `main` hacia `develop`** para no perder la corrección.
6. El CCB revisa el cambio de emergencia y cierra el ticket.

## 11. Proceso de release

1. Crear `release/x.y.z` desde `develop`.
2. Solo correcciones menores, actualización de versión en `package.json` y `CHANGELOG.md`.
3. PR hacia `main`; tras el merge, crear el tag `vx.y.z`.
4. Merge de `main` hacia `develop`.
5. Publicar el *Release* en GitHub con las notas del changelog.

## 12. Estilo de código y pruebas

- ESLint y Prettier son obligatorios: `npm run lint` y `npm run format`.
- Pruebas con Jest: `npm test`. Toda lógica de negocio (descuentos, disponibilidad de asientos, cálculo de tramos) debe tener pruebas.
- Nombres de variables y funciones en español o inglés, pero **consistentes** en todo el proyecto.
- Nunca subir credenciales, `.env`, ni archivos de `uploads/`.
- Antes de agregar una dependencia, verificar que su licencia sea compatible con GPLv3 (MIT, BSD, Apache-2.0 y similares lo son); registrarlo en el PR.

## 13. Uso de herramientas de IA

La IA está permitida y recomendada, con estas reglas:

- **Cada integrante usa su propia herramienta** y hace sus propios commits con su identidad; un agente no commitea en nombre de otros.
- El contexto compartido (convenciones, estructura, stack) está en `AGENTS.md`, para que cualquier asistente trabaje con las mismas reglas.
- **El código generado se revisa y se entiende antes de commitear.** Quien abre el PR responde por él.
- No pegar credenciales ni datos reales de usuarios en la IA.

## 14. Definición de "terminado"

Un cambio está terminado cuando:

- [ ] El código cumple lo descrito en el ticket.
- [ ] Pasa `lint` y `test`.
- [ ] Funciona con `docker compose up`.
- [ ] La documentación afectada está actualizada.
- [ ] El PR fue revisado y aprobado por otro integrante.
- [ ] Está integrado en `develop` y el ticket de Jira está en *Cerrado*.

## 15. Reglas que nunca se rompen

1. ❌ Push directo a `main` o `develop`.
2. ❌ Commits sin clave de Jira o sin formato convencional.
3. ❌ Aprobar tu propio PR.
4. ❌ Reescribir el historial compartido (`push --force` en ramas compartidas).
5. ❌ Subir secretos al repositorio.
6. ❌ Cancelar o rechazar un cambio sin dejar el motivo escrito.

---

Si algo de esta guía no está claro, abre un issue con la etiqueta `question` o consulta al comité. Al contribuir aceptas cumplir el [Código de Conducta](CODE_OF_CONDUCT.md) y que tus aportes se distribuyan bajo la licencia [GNU GPL v3.0](LICENSE) del proyecto.
