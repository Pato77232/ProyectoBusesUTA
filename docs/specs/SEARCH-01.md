# SEARCH-01: búsqueda pública de viajes comercializables

Propuesta concreta para la petición de Edwin de completar la entrega el 4 de noviembre de 2026. ID local, no ticket externo. Sin implementación ni aprobación técnica individual de David/Leslie inferida. Requiere confirmar este contrato antes de producto.

Edwin confirma «Apruebo los tres contratos» el 4 de noviembre, incluidos SEARCH-01, BOLETOS-01 y AUTH-CORREO-01. Se autoriza implementar por incrementos; revisión humana de código pendiente. Base local: cadena de INTEG-01, Fleet-08, SMTP y formato publicados, aún no integrada en develop.

GET `/api/v1/trips?origin=Loja&destination=Ambato&date=2026-11-04`, público y solo lectura. Origen/destino por nombre normalizado exacto; date es la fecha local de embarque en America/Guayaquil, no necesariamente la salida del origen del recorrido. Incluye embarques en paradas. No aceptar tenant, precio ni reloj del cliente. Solo devolver viajes publicados y todavía comercializables según el contrato real de Route Sheets, con precio explícito por par, moneda USD y asientos ofrecidos del inventario congelado. Sin sumar precios consecutivos ni publicar hojas antiguas incompletas.

Search consume la API pública de Route Sheets y el nombre público de cooperativa por API de Tenants, sin SQL ajeno. Route Sheets resuelve candidatos desde sus tablas y revalida cada viaje mediante su consulta comercial. Respuesta: trips [{tripId,cooperativeId,cooperativeName,fromPosition,toPosition,boardingAt,arrivalAt,origin,destination,currency,amountCents}]. La búsqueda no promete ocupación libre; Bookings comprueba disponibilidad por viaje/tramo al seleccionar. Orden por embarque y luego identidad; límite de resultados acotado con aviso explícito de truncamiento, nunca inventar viajes. Fuente caída no equivale a lista vacía: 503; formato inválido 400; búsqueda válida sin resultados 200/[]; sin PII de compradores/pasajeros.

Pantalla pública de búsqueda y enlace a reservas con viaje y posiciones. DESIGN.md: marca/tokens/Bootstrap existentes, campos etiquetados, mensajes de carga/vacío/error, teclado/foco y móvil. No reserva al pulsar buscar. La pantalla explica precio base y que el resumen autorizado aplica VIP/descuentos.

Pruebas: embarque en parada/cambio de día, viaje ya cerrado, frecuencia inactiva, períodos confirmados, precio no aditivo, fuente averiada, ausencia de PII, enlaces correctos y reflujo. Una tarea API y otra pantalla, commits separados, pruebas PostgreSQL aislado/arranque real/lint/formato. No dependencias nuevas ni migraciones necesarias salvo evidencia contraria.

## Evidencia local de API y formulario, 4 de noviembre

API pública compuesta en servidor: Search consume fábricas públicas de Route Sheets y Tenants, que consultan solo sus tablas propias. Se proyectan columnas públicas y se revalida cada candidato mediante el contrato comercial existente. Límite de 100 resultados más indicador de truncamiento. Sin migraciones ni dependencias nuevas.

Lint backend/frontend aprobado. Dirigidas backend: 18/18, incluidas composición, filtros inválidos antes de proveedor, fallo de fuente sin convertir a vacío y consulta HTTP real sin sesión desde Salcedo a Latacunga con precio explícito 250, más fecha sin resultados. Frontend completo 319/319. Chrome con HTTP controlado (no certifica API real en ese recorrido): enlaces de viaje/tramo correctos, texto hostil como texto y no script, reflujo 1280/360, fallo que retira resultados anteriores y solo GET, aprobados. Captura móvil inspeccionada en QA temporal entrega-search-qa. Backend real PostgreSQL comprobado por separado en la integración.

El smoke de portada asumía que todos los enlaces eran anclas y fallaba desde el login existente. Conserva la comprobación de destinos de anclas y ahora comprueba además mismo origen, HTTP 200 y contenido de aplicación de cada página enlazada. No se salta la comprobación de enlaces. Primera repetición falló por el nombre de variable del harness nuevo; corregido sin cambiar producto, repetición aprobó escritorio, móvil, teclado y reflujo CSS al 200 % (no zoom nativo).

La regresión previa a Search, con Fleet-08/SMTP/formato y PostgreSQL recién creado, aprobó 1940 unitarias y 650 integraciones. No se atribuye esa ejecución a los cambios posteriores de Search. Revisión humana, prueba de empaquetado y publicación de estos incrementos pendientes. No inventa ocupación ni ofrece compra ya confirmada.
