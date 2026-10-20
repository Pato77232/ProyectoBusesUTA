# BOOK-03: Crear reserva y bloquear asientos

- **Responsable:** Leslie
- **Revisor:** Edwin
- **Estado:** Borrador; no implementar escritura hasta cerrar contratos.
- **Módulo:** bookings
- **Dependencias:** BOOK-01/02/04/05, viajes, plantilla e identidad del comprador.

## 1. Objetivo
Reservar todos los asientos del resumen aceptado sin permitir doble ocupación.

## 2. Reglas
RN-02, RN-40, RN-41, RN-42, RN-43 y RN-50. El bloqueo empieza al aceptar el resumen, después de pasajeros y cálculo de descuentos.

## 3. Tareas
T1 dominio de reserva; T2 migración nueva y repositorio transaccional; T3 caso de uso; T4 HTTP con protección CSRF y botón de confirmación. Una rama y commit por tarea.

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
