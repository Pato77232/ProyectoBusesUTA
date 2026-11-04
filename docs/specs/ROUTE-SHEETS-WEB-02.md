# ROUTE-SHEETS-WEB-02 — editor de programación y tarifas (2.2)

- Responsable: David; implementación solicitada el 4 de noviembre de 2026.
- Base local `cc7d4c5`, árbol limpio; misma rama `feature/ROUTE-SHEETS-10-consulta-ocupaciones` por petición expresa. Sin refresco remoto ni revisión humana inferidos.
- Estado: implementación autorizada. Fuentes: RN-02/20–23/30–32/43 y [reglas](../business-rules.md), ROUTE-SHEETS-04/05/06/07, [arquitectura](../architecture.md), [convenciones](../conventions.md), [calidad](../calidad.md), [protocolo académico](../errores-inducidos.md).

## 1. Alcance

Editor `/pages/programar-hoja.html?id=<UUID>` enlazado desde el listado existente. Cabecera/grupo/fecha/estado del servidor, programación y tarifas en formularios; no JSON ni identificadores técnicos como campos de negocio. Publicadas solo lectura. Sin publicación, renovación, generación automática, sustitución, venta o interfaz de Chofer/Controlador: corresponden a 2.3 u otras tareas.

La consulta necesaria `GET /api/v1/route-sheets/:id/editor`, COOPERATIVE_ADMIN, sin query/body autoritativos, devuelve cabecera propia, programación y tarifario con revisiones independientes, buses del grupo y frecuencias activas más las referenciadas por datos guardados. Snapshot propio en transacción REPEATABLE READ READ ONLY; liberar conexión antes de consultar Fleet/Frecuencias por sus APIs públicas existentes. Todo filtra por cooperativa verificada; 404 hoja ajena/inexistente; proveedor fallido/malformado no equivale a listas vacías. No SQL de otros módulos. Sin nuevos permisos globales, migraciones ni dependencias.

## 2. Programación

Formulario de duración explícita en días, servicios requeridos (frecuencia y fecha, hora autorizada derivada de la frecuencia), agendas por bus del grupo con disponibilidad inicial y ubicación, asignaciones SERVICE, traslados con origen/destino, descanso/mantenimiento con motivo e instantes. Fechas y horas locales de Ecuador continental, UTC−05:00; manejar medianoche sin convertir la fecha civil. Preparación explícita no negativa, nunca inferida de conteos. El servidor valida cobertura, continuidad, repetibilidad, bloqueos y compromisos entre hojas.

Identidades nuevas por alta local y conservación de IDs al editar/recargar. Frecuencia/salida de servicios ya persistidos se presenta inmutable conforme al libro de identidades; para cambiarla retirar asignación/servicio y crear otro explícitamente. No retirar un servicio requerido mientras tenga asignaciones locales. Datos derivados del GET (tenant, grupo, ubicaciones SERVICE, readyAt) no se reenvían. PUT /:id/programming contiene solo expectedRevision y programación estricta. La fecha inicial coincide con la hoja; el reemplazo integral exige revisión y confirmación, con aviso si adopta asignaciones/días legados.

## 3. Tarifas

Basar el formulario en frecuencias de la programación guardada, no en cambios locales sin persistir. Precios USD positivos por cada combinación válida de puntos, sin suma automática; porcentajes explícitos (0–100 con hasta dos decimales) de VIP, menor, tercera edad y discapacidad. Convertir entradas decimales a centavos/bps con enteros, no cálculo comercial en la vista. PUT /:id/tariff envía expectedRevision/policy/frequencies; solo el backend configura/valida. Al cambiar programación conservar importes solo para la misma frecuencia y recorrido; combinaciones nuevas quedan vacías, sin precios fabricados. Separar revisiones y guardados: no prometer atomicidad entre ambos PUT.

## 4. Seguridad y recuperación

Cliente API/CSRF compartido, sesión/rol/tenant verificados antes y después, una operación a la vez y sin guardados automáticos. Revisar resumen humano antes de confirmar. Guardar con revisión leída; conflicto conserva cambios locales y exige descartar/recargar explícitamente antes de sobrescribir. Publicadas no se editan aunque se manipule la UI; backend conserva guardas existentes.

Después de respuesta perdida/5xx/DTO inválido, bloquear escrituras y consultar el estado actual; no repetir PUT. Comparación canónica por identidades/contenido e instantes normalizados, independiente del orden de lectura. Una versión actual coincidente confirma contenido guardado, sin atribuir autoría; versión diferente produce conflicto, sin pisar cambios. No enviar tenant/actor ni permitir editar revisiones. Avisar al salir si hay cambios locales sin guardar.

## 5. Diseño y verificación

Adopción explícita de [DESIGN.md](../../frontend/DESIGN.md): marca, tokens, Bootstrap y CSS local del editor; sin modificar navegación global ni estilos compartidos. Etiquetas, leyendas, mensajes accesibles, foco, teclado, estados por texto, tarjetas adaptables. Verificar escritorio/móvil, contraste y reflujo; declarar límites de zoom nativo/lector de pantalla y revisión humana.

Unitarias para serialización/IDs/fechas/decimal/tenant/revisiones/recuperación; integración del endpoint con Auth/proveedores/PostgreSQL reales; navegador e imagen con alta/edición/recarga de programación, traslados/bloqueos/paradas, tarifas no aditivas, conflictos y respuesta perdida. Conservar todas las pruebas anteriores conforme a la decisión de David. Ejecutar frontend y backend lint/formato/tests, arranque real y revisión del diff; registrar resultados reales y entornos aislados retirados. Sin commits/publicación/integración autorizados.

## 6. Evidencia

Implementación local completada el 4 de noviembre de 2026 sobre `cc7d4c5`, en la rama indicada. Asistencia de Codex en planificación, implementación y verificación; no integrada/cerrada ni revisada por una persona. Sin commits ni publicación.

- Endpoint de lectura propio y composición real de Fleet/Frecuencias; editor estructurado enlazado al listado, incluido en la imagen frontend. Sin migraciones, dependencias nuevas ni cambios en pruebas históricas.
- Frontend: lint aprobado y **298/298 pruebas aprobadas**, 17 nuevas. Backend: lint aprobado; **5/5 unitarias nuevas y 4/4 integraciones nuevas aprobadas**, estas últimas con Auth, PostgreSQL y arranque real.
- Regresión backend: **1902 unitarias aprobadas y 9 fallidas** (dobles históricos de composición/servidor, cambio de estado y catálogo de migraciones). **612 integraciones aprobadas y 22 fallidas**: 21 fallos históricos de contratos/migraciones y timeout de fotos; un fallo adicional por deadlock en `frequencies/guarded-deactivation.test.js`. Repetición aislada posterior de ese archivo: **7/7 aprobadas**. No presentar ambas ejecuciones como una suite completa verde. Un primer intento de repetición omitió DATABASE_URL y fue rechazado por la protección de pruebas, antes de ejecutar negocio; corregido sin cambiar código.
- Formato de todos los archivos JS/CJS/CSS/HTML del cambio aprobado; `git diff --check` aprobado. El chequeo global backend conserva **36 archivos previos** con formato pendiente, sin reformatearlos incidentalmente.
- QA Chrome con imágenes reales y PostgreSQL separado aprobado: dos buses/dos servicios, medianoche/paradas, traslados, descanso/mantenimiento, precios por par no aditivos, identidades preservadas, revisiones independientes, conflicto sin escritura, pérdida de respuesta después de PUT sin reenvío, rechazo de solapamiento sin cambiar persistencia, publicadas solo lectura y cambio de sesión/tenant/rol. Recorrido de foco Tab/Enter para cancelar revisión sin PUT y contraste de texto/nota/botón >=4.5 comprobados. Un intento intermedio del navegador terminó con error del entorno sin completar verificaciones; repetición final completa aprobada.
- Capturas 1280/360/640 sin desbordamiento horizontal, inspección visual de escritorio y móvil. Zoom nativo al 200 %, lector de pantalla y revisión humana siguen pendientes; reflujo de viewport no sustituye esos controles. [Evidencia reproducible](../evidence/ROUTE-SHEETS-WEB-02/README.md).

Publicación/renovación web (2.3) sigue pendiente. La publicación por API de la prueba solo prepara el escenario de lectura de hojas publicadas. Entornos temporales retirados después de la ejecución.
