# BOOK-03 / L-03: completar reserva real y persistida

- **Planificación:** L-03; no es una spec aprobada ni un ID externo.
- **Spec existente:** [BOOK-03](BOOK-03.md).
- **Responsable:** Leslie Coello.
- **Revisor propuesto:** Pablo, conforme a la preferencia previa de Leslie; aceptación de este incremento pendiente. Coordinar contratos con los responsables indicados.
- **Estado:** Borrador; implementación de los nuevos incrementos no autorizada.
- **Base:** rama `feature/BOOK-03-resumen-creacion-dominio`, `c7ceed9`; remoto `origin/develop b60201e`, consultado el 1 de noviembre de 2026, sin integrar.
- **Autorización:** el usuario pidió preparar specs antes de implementar; no se infiere aprobación de este borrador.
- **Referencias:** [plan y evidencia](../reservas-plan-primera-entrega.md), [acuerdos vigentes](https://github.com/Pato77232/ProyectoBusesUTA/blob/b60201e/docs/acuerdos-primera-entrega.md), arquitectura y calidad del proyecto.

## 1. Objetivo

Adaptar la reserva local existente a viaje, política de hoja y propiedad confiables; no rehacer transacción e idempotencia ya implementadas.

## 2. Reglas

RN-02/40/41/42/43/50. Todos los asientos o ninguno. La aceptación crea reserva y plazo; el body no determina precio, dueño o cooperativa.

## 3. Alcance

Primero completar contratos de BOOK-03. Después ampliar persistencia únicamente mediante migraciones nuevas. Compra registrada existente y acceso invitado son alcances separados; el invitado no se considera resuelto con un UUID.

## 4. Flujo

Autenticar/resolver propietario → validar intento y resumen aceptado → adquirir control de inventario → releer viaje, política, acreditación y cada asiento → detectar cambios/solapamientos → persistir reserva, pasajeros, desglose, relación a programación, inventario e idempotencia → commit. Un fallo revierte todo; una respuesta perdida se recupera por la misma clave.

## 5. Datos propuestos y reutilización

Persistencia local: bookings con resumen JSONB/pasajeros y totales; booking_seat_allocations; booking_trip_locks; clave y huella de creación por propietario. No declarar ausente este esquema por leer una spec antigua de develop.

Faltan referencias persistidas comprobables a hoja, asignación, bus y revisión comercial/inventario para las consultas de David y el precio congelado. Elegir campos y restricciones tras el contrato real; no editar migraciones 1793145600000 ni 1793232000000. Definir si extensión JSONB es suficiente y qué columnas/índices requieren consultas e integridad.

Propiedad registrada: usuario CUSTOMER verificado por servidor. Invitada: contrato con Auth, credencial secreta/hash, vencimiento, alcance, CSRF y recuperación por correo pendientes; no aceptar ownerId en body. Definir estabilidad de propietario/idempotencia al vincular una compra invitada a cuenta.

## 6. Endpoints

Reutilizar POST /api/v1/bookings, POST /summary y GET /attempts/:requestKey locales, sin ampliar acceso a invitado por accidente. Documentar compatibilidad de revisión y política antes de adaptar respuestas.

## 7. Criterios de aceptación pendientes

- [ ] Dos compradores del mismo asiento con intervalos parcialmente superpuestos producen una sola reserva.
- [ ] Fallo del segundo asiento revierte reserva, pasajeros, clave y todas las ocupaciones.
- [ ] Asientos adyacentes y cooperativas independientes conservan sus reglas.
- [ ] Cambiar política/recorrido/inventario exige revalidación y nueva aceptación cuando corresponda.
- [ ] Reintento de mismo propietario/clave/datos recupera ID y plazo sin nuevas escrituras; clave con otros datos da conflicto.
- [ ] Viaje/hoja/asignación/bus persistidos son coherentes y permiten L-05.
- [ ] Datos de propietario, importes o tenant del body nunca sustituyen fuentes verificadas.

## 8. Casos borde

COMMIT realizado con respuesta perdida; proveedor caído tras bloqueo; cambio de tarifa/asiento; varios asientos, intento concurrente, claves cruzadas entre compradores, sesión vencida e invitado sin credencial.

## 9. Pruebas previstas

Conservar pruebas de T2/T3/T3-R y sumar integración PostgreSQL con barreras para superposición parcial real, rollback completo, relación persistida y cambios entre hojas. Comprobar dos instancias/conexiones y lectura tras reinicio; tests en memoria no acreditan RN-40.

## 10. Decisiones necesarias

L-01/L-02; identidad/estabilidad de asignación y política; control de cambios del proveedor bajo concurrencia (releer sin protocolo compartido no garantiza coherencia ante escrituras externas); propiedad invitada. Recomendación: mantener bloqueo actual por viaje y acordar orden compatible de bloqueo con L-04/L-05 antes de añadir transición por reserva.

## 11. Defecto inducido

No aplica. No introducir ni corregir incidentalmente defectos académicos; seguir errores-inducidos.md.

## 12. Diseño y usabilidad

Dominio puro, aplicación orquesta y PgBookingRepository persiste. Otros módulos no escriben tablas de reservas. Resumen de errores recuperables para L-06; esta spec no cambia interfaz.

## 13. Incrementos y archivos previstos

1. Completar contratos de BOOK-03/T3 y relaciones; resultado: modelo/propiedad aprobados.
2. Nueva migración, repositorio y servicio de creación; resultado: transacción extendida verificable.
3. Concurrencia, idempotencia y arranque/API con proveedores reales; resultado: evidencia de no doble ocupación.

No hacer migraciones ni reescribir historia en esta fase documental. Verificar lint, format:check y npm test desde backend con PostgreSQL aislado al implementar; arranque si cambia composición.
## 14. Revisión y cierre

Revisión humana, autorización de incremento e integración pendientes. Ningún criterio futuro se marca aprobado por la existencia de este borrador. Evidencia documental de esta sesión en el plan; resultados de producto pendientes.

### Identidad del asiento — respuesta de Edwin, 2 de noviembre de 2026

FLEET-06 expone seatQueries.listByBus({ busId, cooperativeId }); contrato recibido y comprobado en origin/develop 7c150c7. La reserva debe relacionar ocupaciones con seatId UUID propio del bus, no layoutSeatKey, que se repite entre buses. Solo offered true entra en la oferta; category actual solo NORMAL. Guardar además los datos descriptivos y referencias de contexto necesarios para consultar la reserva sin recalcular inventario vigente, con el modelo que se apruebe.

La propuesta de conservar seatId en la compra no sustituye inventario versionado por hoja. Referencia histórica hoja/asignación/bus/política sigue pendiente con David/Edwin. No crear FK improvisada ni editar migraciones existentes; la ampliación se hará después del contrato y su autorización. Resumen/ocupaciones ya persistidos no se migran ni reinterpretan en esta sesión documental.
