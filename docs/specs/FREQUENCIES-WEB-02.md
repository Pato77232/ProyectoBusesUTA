# FREQUENCIES-WEB-02 — consulta, detalle y estado (2.1)

- Responsable: David, solicitud directa del 4 de noviembre de 2026.
- Base local: `95579e2`, árbol limpio en `feature/ROUTE-SHEETS-10-consulta-ocupaciones`. El usuario solicita continuar bloque 2 en esta misma rama. Sin actualización remota ni aprobación humana inferida.
- Estado: implementada y verificada localmente; revisión humana pendiente, no integrada/cerrada.
- Fuentes: RN-02/20–23 en [reglas](../business-rules.md), FREQ-01/03, FREQUENCIES-WEB-01, [arquitectura](../architecture.md), [convenciones](../conventions.md), [calidad](../calidad.md), [flujo](../flujo-codex.md), [protocolo académico](../errores-inducidos.md).

## 1. Alcance y contratos

Página `/pages/frecuencias.html`, COOPERATIVE_ADMIN: consultar todas sus frecuencias, filtrar por origen/destino/estado, abrir detalle real y cambiar ACTIVE/INACTIVE con confirmación. Enlace local desde/hacia alta existente; sin navegación global ni cambios compartidos de diseño. No modifica backend, login, transporte, tarifas de venta, programación ni otros incrementos del bloque 2.

GET `/api/v1/auth/me` comprueba sesión/rol/tenant; GET `/api/v1/frequencies` devuelve `{frequencies}` con filtros exactos normalizados (omitir vacíos, sin paginación artificial); GET `/:id` devuelve `{frequency}`; PATCH `/:id/status` envía solo `{status}` con cliente API/CSRF compartido. Tenant e identidad proceden de sesión, no de formularios. Validar DTO/UUID/tenant, duplicados, filtros, paradas/precios y estado, sin mostrar datos no verificables. Texto con textContent, no HTML del servidor.

Detalle: origen, destino y hora inmutables; resolución ANT, estado, recorrido ordenado y valores históricos por tramo, rotulados como distintos de la tarifa comercial configurada en hojas. No inventar llegada/horarios de paradas. La desactivación depende de FREQ-03, no del navegador: 409 explica compromisos/ciclo; 503 indica comprobación no disponible. No cancelación forzada, programación diferida automática ni eliminación.

## 2. Sesión y confirmación

Una operación a la vez y controles bloqueados durante carga. Verificar identidad antes/después de lecturas y mutación. Cambio de usuario/cooperativa borra información, bloquea operaciones y exige recargar; rol insuficiente/sesión vencida tienen mensajes y enlace de login. Error de listado limpia resultados anteriores; vacío se distingue de fallo.

Abrir confirmación, permitir cancelar y releer detalle antes de PATCH. Si otro actor cambió el estado o datos inmutables, cancelar intención y pedir nueva revisión. No cambiar estado optimistamente. Respuesta válida del PATCH y sesión estable confirman; red/5xx/DTO corrupto después de enviar generan resultado incierto, sin reintento automático. Consultar explícitamente el estado actual con GET y revalidar identidad antes de habilitar otra intención. Leer estado actual no atribuye autoría al cambio ni demuestra por sí solo cuál petición lo produjo.

## 3. Diseño, calidad y pruebas

Se adopta [DESIGN.md](../../frontend/DESIGN.md): marca/recursos locales, blanco/negro/violeta, tokens, tarjetas, foco y Bootstrap existentes. CSS limitado a la pantalla; no copiar referencia como comandos/dependencias. Tabla desplazable en móvil; etiquetas/legend, aria-live/busy, estados por texto, navegación por teclado y foco al abrir detalle/confirmación o error. Comprobar 360/1280 px, contraste y 200 %; declarar límites reales de QA.

Separar contratos puros, controlador y vista; reutilizar cliente API. Empaquetar página/CSS mediante listas explícitas de Dockerfile/.dockerignore; directorio de módulos ya incluido. Sin dependencias ni migraciones. Añadir unitarias de estados/tenant/confirmación/error/ambigüedad y navegador con imagen, Nginx, API/Auth/PostgreSQL reales, capturas e inspección. Conservar todas las pruebas anteriores, según decisión expresa de David. Ejecutar frontend lint/tests/formato propio y verificaciones backend exigidas; reportar regresión fallida sin adaptar pruebas ni ocultar resultados.

## 4. Evidencia

Frontend 281/281 aprobadas, incluidas 18 nuevas; lint y formato de los nueve archivos propios aprobados. Prueba real en imagen/Nginx/API/PostgreSQL y Chrome aprobada: filtros, detalle, teclado/cancelación, cambio verificado, 409 con ciclo publicado, respuesta perdida sin reenvío, identidad/tenant/rol, vacío, texto seguro, caída/recuperación de red y reflujo a 360/640/1280 px. Contraste de texto principal, ayuda y botón cumple 4,5:1. Capturas móvil/escritorio inspeccionadas.

Las unitarias adicionales comprueban DTO ajeno/corrupto, 503 de compromisos, 503 técnico incierto, doble confirmación y fallo de sesión posterior a PATCH recibido. Un 503 genérico no se confunde con rechazo definitivo; se conserva comprobación explícita del estado actual. Primer smoke fallido por pulsación incompleta de Enter en el harness nuevo; se corrigió la secuencia, no la aserción ni el producto, y la repetición aprobó.

Backend sin cambios funcionales: lint aprobado; formato global mantiene 36 archivos previos; `npm test` 1897 unitarias aprobadas/9 fallidas. Integración por separado: 609 aprobadas/21 fallidas, 48 suites aprobadas/6 fallidas, 274,208 s. Se conservan los fallos históricos documentados en BOOK-03-L03-T1 y todas las pruebas previas. No se presenta regresión global aprobada.

[Evidencia y reproducción](../evidence/FREQUENCIES-WEB-02/README.md), incluidas capturas y límites. Zoom nativo 200 % y lector de pantalla pendientes de comprobación humana; reflujo de viewport no los sustituye. Diff completo y archivos nuevos revisados, `git diff --check` aprobado. Sin backend, migraciones ni dependencias nuevas. Entornos efímeros retirados. No commit, publicación, integración ni revisión humana acreditados. Asistencia de Codex en planificación, implementación y QA.
