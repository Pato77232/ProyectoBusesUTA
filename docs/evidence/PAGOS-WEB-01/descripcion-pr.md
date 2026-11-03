# feat(pagos): agrega bandeja web de comprobantes

## Resultado

El oficinista puede abrir /pages/comprobantes.html y consultar los comprobantes pendientes de su cooperativa, con total USD, fecha Ecuador, archivo privado y paginación anterior/siguiente. La pantalla comprueba la sesión y distingue carga, vacío, falta de permisos y error recuperable; no envía identidad ni cooperativa elegidas por el navegador.

Aplica la identidad visual transViaje y DESIGN.md, con recursos locales, foco visible y adaptación móvil. Las rutas de Payments incorporan Cache-Control no-store para evitar conservar listados/archivos privados en cachés HTTP. Los nombres de archivo se insertan como texto; sin almacenamiento del navegador. Conserva los recursos y comandos de la pantalla de Frecuencias.

## Alcance y trazabilidad

Refs: docs/specs/PAGOS-WEB-01.md. RN-02 y lectura de RN-52.

Base: develop 5abc36d. Rama preparada: feature/PAGOS-WEB-01-bandeja-pr. Revisor: Pablo, pendiente de revisión humana.

El lector de Reservas sigue simulado en la composición existente; los datos de pruebas son exclusivamente QA. No habilita aprobación, rechazo, correcciones, carga, caja ni QR. No cambia reglas de negocio, esquema, migraciones, dependencias o autenticación.

## Validación

- 168 pruebas frontend aprobadas y lint/formato propio aprobados.
- Backend: lint aprobado; 1298 unitarias + 372 integraciones aprobadas con Node 24/PostgreSQL 16.13 aislados, configuración original y código actual.
- Navegador/imagen/proxy/BD reales: sesión/roles, aislamiento de cooperativas, 50+1 con paginación, archivo privado, XSS, vacío/error, teclado, móvil y texto 200 % aprobados.
- Arranque real: salud 200, listado/archivo sin sesión 401 con no-store.
- Formato global falla en 17 archivos previos ajenos; sin modificar esos archivos ni debilitar pruebas. CI remoto aún no ejecutado.
- Evidencia y capturas en docs/evidence/PAGOS-WEB-01/.

Asistencia de IA utilizada para implementación, pruebas y documentación. No sustituye revisión humana.
