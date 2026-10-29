# BOOK-03: Crear reserva y bloquear asientos

- **Responsable:** Leslie
- **Revisor propuesto por Leslie:** PabloToapanta
- **Estado:** T1/T2/T3 y T4 A (API protegida) implementados localmente; revisión humana pendiente. Pantalla y proveedores reales sin conectar; el servidor responde 503 a compras nuevas mientras falten.
- **Módulo:** bookings
- **Dependencias:** BOOK-01/02/04/05, viajes, plantilla e identidad del comprador.

## 1. Objetivo
Reservar todos los asientos del resumen aceptado sin permitir doble ocupación.

## 2. Reglas
RN-02, RN-40, RN-41, RN-42, RN-43 y RN-50. El bloqueo empieza al aceptar el resumen, después de pasajeros y cálculo de descuentos.

## 3. Tareas
T1 dominio de reserva; T2 migración nueva y repositorio transaccional; T3 caso de uso; T4 HTTP con protección CSRF y botón de confirmación. Una rama por funcionalidad y un commit por tarea; un solo PR de creación de reservas hacia develop, con especificaciones, código y pruebas.

## 4. Flujo
Resolver comprador y viaje en el servidor; validar todos los asientos, pasajeros y precios; revalidar disponibilidad bajo bloqueo; persistir reserva y ocupaciones en una transacción; devolver identificador y vencimiento. Cualquier fallo revierte todo.

## 5. Datos
Entrada prevista: viaje, tramo, selección y pasajeros. No aceptar precio, propietario ni cooperativa como autoridad del cliente. Tablas bookings y ocupaciones por definir con los contratos reales; no inventar FK a tablas ajenas inexistentes. La protección debe cubrir también dos tramos parcialmente superpuestos, no solo igualdad de extremos.

## 6. Endpoints
Propuesta: POST /api/v1/bookings; 201, 400, 401, 403, 404, 409. Identidad del invitado, sesión, propiedad y CSRF requieren contrato aprobado antes de publicar.

## 7. Criterios de aceptación
- [ ] Dos solicitudes simultáneas incompatibles producen una reserva, la otra conflicto.
- [ ] Si un asiento falla, ninguno de la solicitud queda reservado.
- [ ] No se reserva antes de aceptar el resumen.
- [ ] No hay manipulación de precio, identidad, cooperativa o asiento ajeno al viaje.
- [ ] La reserva persiste con plazo configurable válido.

## 8. Casos borde
Asientos repetidos, pasajeros incompletos, viaje cerrado, precio cambiado, reintento y conflicto por tramo. Acordar política de idempotencia y actualización del resumen antes de implementarlas.

## 9. Pruebas
Dominio y caso de uso con puertos; migración reversible y concurrencia contra PostgreSQL aislado; HTTP real y pantalla. Una prueba con memoria no acredita RN-40 en producción.

## 10. Preguntas abiertas
Esquema de viajes/asientos; identidad de invitado; precios/descuentos; estados exactos; inicio del plazo según método de pago y política de reintento.

## 11. Defecto inducido
No aplica.

## Aclaración para revisión documental
Las decisiones de producto de `docs/reservas-decisiones.md` fueron seleccionadas por autorización de Leslie y cierran las preguntas correspondientes de este borrador. No se atribuye aprobación a otros integrantes. Los contratos reales pendientes están en `docs/reservas-contratos.md`; esta rama no implementa código, endpoints, tablas ni pantallas. Los avances de dominio existentes se conservan en sus ramas de tarea separadas.

## Actualización T1 — resumen y creación inicial de dominio
Alcance autorizado por Leslie el 27 de octubre de 2026: [BOOK-03-T1](BOOK-03-T1.md). Se agrupan dos partes en la rama feature/BOOK-03-resumen-creacion-dominio, con un commit por parte y una futura revisión de la entrega conjunta. El resumen compone pasajeros, tramo y tarifas de contexto de servidor; partes A y B implementadas localmente. La creación inicial se limita a un valor de dominio, sin escritura ni bloqueo. T2/T3/T4 siguen condicionadas a contratos reales de viaje/asientos e identidad. La aclaración documental anterior es histórica; esta sección no declara disponible una reserva de producción.

## Actualización T2 — 28 de octubre de 2026
Leslie autorizó elegir el contrato de viajes/asientos conforme a la delegación que transmite de David y Edwin. [BOOK-03-T2](BOOK-03-T2.md) fija ese contrato y su alcance. Migración y repositorio transaccional locales implementados y probados contra PostgreSQL: todos los asientos o ninguno, con bloqueo por cooperativa/viaje y detección de solapamiento. La decisión de identificadores lógicos y su límite referencial están en [ADR 0005](../adr/0005-bloqueo-inventario-reservas.md). Todavía no existe compra HTTP ni adaptación real de los proveedores; no se debe usar catálogo ficticio en producción.

## Actualización T3 — 29 de octubre de 2026

[BOOK-03-T3](BOOK-03-T3.md) conecta la consulta del resumen con el caso de uso de creación. Resuelve comprador por un puerto de identidad verificada, catálogo y acreditación por proveedores internos; detecta cambios del resumen mediante revisión canónica y exige nueva aceptación. Relee viaje, acreditación y hora después del bloqueo de T2 antes de guardar. No habilita HTTP, ni crea proveedores ficticios; T4, recuperación/idempotencia y composición real siguen pendientes. Se mantiene un único PR futuro para creación de reservas; no se solicita reabrir el PR documental #17.

## Actualización de reintentos — 29 de octubre de 2026

[BOOK-03-T3-R](BOOK-03-T3-R.md) implementa recuperación idempotente con requestKey por comprador verificado y huella del contenido aceptado. La misma solicitud recupera la reserva y sus fechas persistidas, incluso si se perdió la respuesta tras COMMIT o el catálogo ya no responde. Reutilizar la clave con otros datos da conflicto. Reserva, ocupaciones y clave se guardan atómicamente; una operación revertida no consume el intento.

La limitación de reintentos de T3 es histórica y queda resuelta para la ruta con requestKey. La ruta privada antigua sin clave mantiene su contrato, por compatibilidad; T4 deberá exigir clave para toda creación pública. API, pantalla, proveedores reales y actualización con develop siguen pendientes; este paso se conserva en el mismo PR funcional futuro.

## Actualización T4 A — 29 de octubre de 2026

[BOOK-03-T4](BOOK-03-T4.md): API protegida de disponibilidad, resumen y creación montada en app.js/server.js. Auth y CSRF reales, claves de reintento obligatorias por HTTP, plazo configurable y sin caché. [Contrato para frontend](../reservas-api.md). El catálogo y la acreditación faltantes producen 503 sin escrituras ficticias; las pruebas inyectan fixtures identificadas.

Base actualizada con develop f26415d en 8df558a; se conserva la prueba revisada de flota y el montaje de pagos. Validación conjunta: 951 pruebas aprobadas, incluido arranque real. Pantalla T4 B, proveedores reales y revisión humana pendientes; todavía no es compra de producción completa ni se publica un PR por tarea.
