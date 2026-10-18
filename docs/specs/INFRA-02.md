# INFRA-02: Soporte multiplataforma para pruebas y saltos de línea (Windows + format:check)

- **ID local:** INFRA-02
- **Ticket externo:** pendiente de elegir gestor después del 4 de noviembre de 2026
- **Módulo:** infra
- **Responsable:** Shirley
- **Revisor:** Pablo
- **Estado:** Borrador (pendiente de revisión por Pablo)

> Decisiones **propuestas** (pendiente de revisión por Pablo). Esta spec es de infraestructura de desarrollo; no agrega reglas de negocio ni modifica módulos de negocio.

## 1. Objetivo

Garantizar que `npm test` funcione correctamente en entornos Windows y que `npm run format:check` no falle por inconsistencias de saltos de línea (CRLF vs LF) entre sistemas operativos. Es una especificación de soporte técnico transversal, prerequisito para que el resto del equipo ejecute pruebas y formateo sin fricción en cualquier sistema operativo.

## 2. Reglas de negocio involucradas

- Ninguna directamente. Esta spec es de infraestructura de desarrollo y no toca reglas de negocio (RN-xx).

## 3. Alcance

**Incluye:**
- Agregar `cross-env` como `devDependency` en `backend/package.json`.
- Modificar el script `test:integration` de `backend/package.json` para usar `cross-env NODE_ENV=test jest tests/integration --runInBand`.
- Crear archivo `.gitattributes` en la raíz del repositorio con la regla `* text=auto eol=lf`.

**No incluye:**
- Ejecutar `prettier --write` sobre código existente.
- Modificar código de módulos de negocio ni de las capas `domain`, `application`, `infrastructure` o `interfaces` de ningún módulo.
- Cambiar scripts de `package.json` distintos a `test:integration`.
- Configurar CI/CD ni pipelines.

## 4. Decisiones propuestas (pendiente de revisión por Pablo)

| Tema | Decisión |
|------|----------|
| Variable de entorno en Windows | `cross-env` para establecer `NODE_ENV=test` de forma multiplataforma en scripts de npm |
| Saltos de línea en el repositorio | `.gitattributes` con `* text=auto eol=lf` para normalizar a LF |
| Versión de `cross-env` | Estable disponible al momento de instalar, con justificación y aprobación humana (se fija por `package-lock.json`) |
| Responsable / Revisor | Shirley / Pablo |

## 5. Tareas (pequeñas, una por entrega)

### T1 — cross-env en script `test:integration` *(autorizada)*

- **Dependencias de la tarea:** ninguna de negocio. Requiere instalar `cross-env` como `devDependency` con aprobación humana.
- `backend/package.json`: agregar `cross-env` a `devDependencies`.
- Cambiar el script:
  ```json
  "test:integration": "cross-env NODE_ENV=test jest tests/integration --runInBand"
  ```
  (reemplaza `"test:integration": "NODE_ENV=test jest tests/integration --runInBand"`).
- **Verificación esperada de T1:** `npm run test:integration` termina sin error en Windows y establece `NODE_ENV=test`. Como `npm test` encadena `test:unit && test:integration`, `npm test` funciona en Windows.

### T2 — `.gitattributes` en la raíz *(autorizada)*

- Crear `.gitattributes` en la raíz del repositorio con el siguiente contenido:
  ```
  * text=auto eol=lf
  ```
- Esto hace que Git normalice los archivos de texto a LF al hacer commit y los sirva con LF en el checkout, evitando diferencias de CRLF/LF entre Windows y Linux/macOS.
- **Verificación esperada de T2:** `npm run format:check` no informa diferencias de saltos de línea entre entornos; clonar el repositorio en Windows produce archivos de texto con saltos de línea LF.

## 6. Endpoints

| Método | Ruta | Roles | Respuestas |
|--------|------|-------|------------|
| Ninguno | N/A | N/A | N/A (infraestructura de desarrollo) |

## 7. Criterios de aceptación

- [ ] Dado un entorno Windows, cuando se ejecuta `npm run test:integration`, entonces `NODE_ENV` vale `test` y las pruebas de integración corren sin error de "no se reconoce como comando interno".
- [ ] Dado un entorno Windows, cuando se ejecuta `npm test`, entonces encadena `test:unit` y `test:integration` correctamente.
- [ ] Dado el repositorio clonado en Windows, cuando se hace checkout, entonces los archivos de texto usan saltos de línea LF (`eol=lf` vía `.gitattributes`).
- [ ] Dado `npm run format:check`, entonces no falla por diferencias de CRLF/LF.
- [ ] `cross-env` aparece en `devDependencies` de `backend/package.json`.
- [ ] El archivo `.gitattributes` existe en la raíz con `* text=auto eol=lf`.
- [ ] No se modificó código de módulos de negocio ni se ejecutó `prettier --write`.

## 8. Casos borde y errores

- `cross-env` no instalado: `npm run test:integration` falla con módulo no encontrado o script inválido; se resuelve instalando el paquete como `devDependency`.
- Archivos ya con CRLF en el checkout de Windows: `.gitattributes` con `eol=lf` los normaliza al hacer commit; el checkout local puede conservar CRLF según `core.autocrlf`, pero la norma del repositorio es LF.
- `format:check` puede seguir fallando por otras razones (comillas, punto y coma, ancho de línea) ajenas a saltos de línea; este cambio solo cubre saltos de línea.

## 9. Pruebas esperadas

- **Unitarias:** ninguna específica de código de negocio; opcionalmente un script de validación que confirme que `package.json` es JSON válido y contiene `cross-env` en `devDependencies`.
- **Integración:** ejecutar `npm run test:integration` en Windows y en Linux/macOS y confirmar que `NODE_ENV=test` se propaga a Jest.
- **Verificación manual de `.gitattributes`:** clonar en Windows y revisar que archivos de texto terminan en LF.

## 10. Preguntas abiertas

- ¿Se agrega `cross-env` también al script `test` o solo a `test:integration`? (Alcance actual: solo `test:integration`, suficiente para que `npm test` funcione en Windows.)
- ¿Qué versión exacta de `cross-env` se instala? (Se justifica e instala con aprobación humana; se fija por `package-lock.json`.)
- ¿Se requieren reglas adicionales en `.gitattributes` para extensiones específicas (`.md`, `.json`, `.js`)? (La regla `*` cubre todos los archivos de texto.)

## 11. Defecto inducido (solo si aplica)

**No aplica.** INFRA-02 no introduce defectos académicos ni vulnerabilidades intencionales.

## Precisiones de verificación

- `cross-env` es un paquete de Node multiplataforma que permite usar variables de entorno tipo Unix en scripts de npm sin depender de la shell de Windows.
- `eol=lf` en `.gitattributes` normaliza saltos de línea a LF en el repositorio; combinado con `text=auto`, Git detecta archivos de texto y aplica la normalización.
- Esta spec no modifica `.gitignore` ni `.prettierrc`.
- No se toca ningún archivo fuera de `backend/package.json` (especificado en la spec) y la creación de `.gitattributes` en la raíz.

## Cierre de infraestructura

Pendiente de implementación (T1, T2). Revisor: Pablo (pendiente de revisión). Sin defectos inducidos.
