# Changelog

Todos los cambios relevantes de este proyecto se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones con [SemVer](https://semver.org/lang/es/) `MAJOR.MINOR.PATCH`.

## [Unreleased]

## [0.1.0] - 2026-11-04

Primera versión entregada. Detalle, recorrido y limitaciones: [docs/releases/v0.1.0.md](docs/releases/v0.1.0.md).

### Añadido

- **Autenticación:** registro e inicio de sesión con cookies de sesión y CSRF; administrador inicial; administrador de cooperativa; alta de oficinistas (CLERK).
- **Flota:** grupos de buses; catálogo de plantillas de asientos; registro de buses con fotografías persistentes, asientos NORMAL/VIP, posiciones no ofrecidas y espacios accesibles identificados; inmutabilidad de los asientos registrados; inventario de asientos por bus.
- **Frecuencias:** alta con origen, destino y hora inmutables, y resolución ANT; paradas y precios por tramo; consulta y cambio de estado web; desactivación protegida ante compromisos.
- **Hojas de ruta:** borradores, programación multifrecuencia, tarifario congelado al publicar, publicación y renovación de ciclos, auditoría de modificaciones, viajes comerciales con inventario congelado y consulta de ocupaciones.
- **Búsqueda pública:** viajes por tramo y fecha, con pantalla pública.
- **Reservas:** disponibilidad real por tramo; cotización con VIP y beneficios (tercera edad, menor de edad y discapacidad) acreditados manualmente por CLERK; creación idempotente con plazo configurable para el comprobante; expiración programada; historial propio; acceso de invitado de un solo uso.
- **Pagos:** carga autorizada de comprobantes con procedencia; bandeja de revisión; aprobación que confirma la venta real; rechazo con justificación obligatoria que libera el asiento.
- **Infraestructura:** Docker Compose con PostgreSQL y Nginx; catálogo validado de migraciones; configuración SMTP segura; cliente HTTP compartido del frontend.
- **Documentación:** guías generales actualizadas; README limitado a las guías principales.

### Corregido

- El catálogo de migraciones vuelve a incluir procedencia de comprobantes, renovación y totales comerciales.
- Conexiones perdidas al integrar: historial, rechazo de comprobantes, confirmador real de venta, canje de invitado, creación comercial, carga autorizada y composición real del servidor.

### Errores académicos

- Ninguno: por decisión de Edwin del 4 de noviembre de 2026, esta versión no incluye errores inducidos.
