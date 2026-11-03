# feat(pagos): prepara lectura de comprobantes con contexto autorizado

La nueva composición de lectura de Payments permite conectar la bandeja al
lector público de Bookings con contexto mínimo verificado por Auth, en lugar de
llamarlo sin identidad. La cooperativa sale de la sesión; el caso de uso fija
REVIEW_PAYMENT, conserva total USD/cursor y traduce relaciones ausentes a
integridad 500 sin omitir comprobantes ni fabricar importes.

Incluye createPaymentReviewModule con proveedor explícito y router solo GET,
no-store para datos privados, adaptador estricto existente y presentador del DTO
compartido con el controlador anterior. Sin cambios de comportamiento a los
consumidores anteriores, migraciones, dependencias o pruebas existentes.

La nueva composición todavía no está activada en server.js: depende de integrar
el proveedor publicado por Leslie y comprobarlo conjuntamente. Esta PR prepara
el consumidor; no acredita carga/venta/QR ni reemplaza la PR #54 de la pantalla.

Validación sobre develop f5b9bde: lint aprobado; 1317 unitarias y 388 integraciones
backend aprobadas con Node 24/PostgreSQL 16.13 exclusivos; 28 pruebas nuevas.
Frontend sin cambios: 144 pruebas aprobadas. Arranque real: salud 200 y listado
sin sesión 401. Formato propio y diff correctos; formato global fallido en 17
archivos previos ajenos. No se afirma CI remoto aprobado.

Las nuevas pruebas HTTP usan Auth/PostgreSQL/archivos reales y lector controlado;
incluyen identidad, tenant, roles, DTO privado, clasificación segura de errores y
ausencia de mutaciones. Prueba conjunta con Bookings real pendiente.

Revisor: Pablo. Evidencia y ejemplo de composición en
docs/evidence/PAGOS-02/2026-11-03-lector-contexto.md. Asistencia de IA utilizada para
implementación, pruebas y documentación; revisión humana pendiente.

Refs: docs/specs/PAGOS-02.md
