# Changelog

Todos los cambios relevantes de este proyecto se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones con [SemVer](https://semver.org/lang/es/) `MAJOR.MINOR.PATCH`.

## [Unreleased]

## [0.2.1] - 2026-11-05

### Añadido

- **Autenticación:** cerrar sesión y cambiar de cuenta (#115).
- **Infraestructura web:** menú de operaciones para cooperativas (#115).
- **Reservas:** preparación del consumo de espacios accesibles (#112).

## [0.2.0] - 2026-11-05

Segunda versión entregada.

### Añadido

- **Boletos:** un boleto por pasajero con código QR opaco (sin datos personales) para cada reserva vendida; página «Mis boletos» imprimible y enlace desde Reservas (#103).
- **Correo:** recuperación de contraseña con enlace de un uso y revocación de sesiones (#97); el puerto SMTP admite un adjunto PNG (#104).
- **Autenticación:** pantalla de registro de clientes (#95); pantallas administrativas de cooperativas, administradores y oficinistas (#101); acceso verificado de invitados por correo y vínculo con sus reservas (#107).
- **Flota:** listado y detalle de buses de la cooperativa (#99).
- **Reservas:** lectura de ventas para boletos (#98); solicitud y acreditación web de beneficios (#106); historial web de reservas propias (#108); contactos de pasajeros y responsables para entregar boletos (#109).
- **Infraestructura:** diagnóstico de migraciones y verificación del recorrido de ciclos y búsqueda (#105).
- **Documentación:** política académica conciliada (#96); contratos de venta accesible (#100, #102), venta en caja (#110) y corrección de comprobantes (#111).

### Corregido

- El catálogo de migraciones quedó desordenado y con marcas repetidas al integrar #107, y el migrador rechazaba el arranque. Se renumeran las migraciones de invitado sin cambiar su SQL (INTEG-02).

### Errores académicos

- Ninguno, como en 0.1.x.

## [0.1.1] - 2026-11-04

### Corregido

- El backend no arrancaba: el merge `26d0c7e` duplicó la composición de Pagos en `server.js` (`SyntaxError: Identifier 'payments' has already been declared`). Se retira el bloque duplicado, junto con la fila de estado y la línea de la spec INTEG-01 que también se duplicaron.

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
