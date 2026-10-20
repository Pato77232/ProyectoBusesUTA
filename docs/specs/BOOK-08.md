# BOOK-08: Consultar reservas e integrar pantallas

- **Responsable:** Leslie
- **Revisor:** Edwin
- **Módulo:** bookings
- **Estado:** Borrador; pendiente de BOOK-03 a BOOK-07 y base frontend.

## 1. Objetivo
Permitir al comprador consultar sus reservas y completar el recorrido hasta pagos.

## 2. Reglas
RN-01/02, RN-40/41/42/43/50/51. RN-54 se comprueba con Shirley sin duplicar su historial de boletos.

## 3. Tareas
T1 consulta autorizada de reservas propias; T2 integrar selección, pasajeros, resumen, confirmación y paso al pago; T3 aceptación y registro de defectos. Bootstrap 5 y JavaScript conforme ADR 0003.

## 4. Flujo
Elegir viaje/tramo y asientos, capturar pasajeros, mostrar cálculo del servidor, aceptar resumen y crear reserva, informar vencimiento, pasar a la pantalla de pagos de Shirley y consultar estado.

## 5. Datos
La identidad se obtiene de la sesión o del mecanismo de invitado aprobado. Mostrar solo reservas propias. No divulgar cédulas, pagos ni reservas ajenas por identificar un UUID.

## 6. Endpoints
Propuestas: GET /api/v1/bookings y GET /api/v1/bookings/:id. Identidad de invitado, respuestas y acceso deben cerrarse antes de implementación.

## 7. Criterios de aceptación
- [ ] Un comprador no consulta reservas de otro ni las altera.
- [ ] La confirmación avisa si otro comprador tomó un asiento mientras se llenaba el formulario.
- [ ] Recargar no extiende el vencimiento ni duplica la reserva.
- [ ] La pantalla usa errores comprensibles, navegación por teclado y estados distinguibles además del color.
- [ ] El recorrido completo tiene evidencia y defectos registrados.

## 8. Casos borde
Sesión vencida, invitado sin acceso, reserva vencida durante la pantalla, pérdida de red y reenvío de confirmación.

## 9. Pruebas y gestión
Unitarias de autorización; integración de acceso cruzado y API; aceptación del recorrido con datos ficticios. Leslie coordina la evidencia de todos, Edwin revisa su código y Leslie revisa el de David. Registrar requisito, versión/commit, reproducción, esperado, observado y estado de cada defecto.

## 10. Preguntas abiertas
Base frontend y enrutamiento; identificación/recuperación del invitado; estados visibles y recuperación ante reintento.

## 11. Defecto inducido
No aplica. Los errores académicos necesitan su spec autorizada y evidencia separada.
