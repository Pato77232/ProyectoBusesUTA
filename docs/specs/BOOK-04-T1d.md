# BOOK-04 T1d: Un pasajero por asiento seleccionado

- **ID local:** BOOK-04-T1d
- **Responsable:** Leslie Coello
- **Revisor propuesto:** Pablo; aprobación pendiente.
- **Módulo:** bookings
- **Estado:** Tarea independiente autorizada por Leslie al solicitar continuar.
- **Reglas:** RN-42, sin atribuir cumplimiento de la concurrencia de RN-40 a una validación pura.
- **Dependencias:** BOOK-04 T1c para datos individuales; T1/T1b ya existentes.
- **Rama:** feature/BOOK-04-T1d-pasajeros-seleccion.
- **Base:** feature/BOOK-04-T1c-datos-pasajero. Es un incremento apilado y no modifica el PR documental #12.

## Objetivo
Validar en dominio que una selección no vacía tenga exactamente un pasajero válido por asiento, antes de persistir una reserva. No necesita tablas ni APIs ajenas.

## Contrato
`createPassengerManifest({ seatIds, passengers }, { onDate })` recibe exactamente dos listas. Los datos de cada pasajero siguen BOOK-04 T1c. La fecha de referencia es explícita y confiable, proporcionada por el futuro caso de uso.

- `seatIds`: lista no vacía de identificadores de texto no vacío; normalizar espacios exteriores igual que el pasajero mínimo. Rechazar duplicados después de normalizar.
- `passengers`: lista con el mismo número de elementos que asientos. Cada elemento se valida mediante `createPassengerDetails`.
- Cada pasajero debe corresponder a un asiento de la selección; no aceptar pasajeros para otros asientos, repetidos o faltantes.
- Devolver una lista y objetos inmutables, en el orden de la selección, independientemente del orden del formulario. No modificar las listas originales ni añadir precio, propietario o acreditación.
- No imponer unicidad de cédula entre asientos: esa política no ha sido acordada. La regla es un pasajero por asiento, no un asiento por persona.
- Rechazar listas dispersas, elementos nulos y propiedades extra. No descartar silenciosamente pasajeros inválidos.

## Límites
La selección se considera validada por el futuro caso de uso contra la plantilla real. Esta función solo comprueba correspondencia y datos. No certifica que el asiento pertenezca al bus, que esté disponible o que haya sido bloqueado. Tampoco persiste datos, calcula descuentos ni acepta comprobantes. No hay endpoint o pantalla en esta tarea.

## Criterios de aceptación y pruebas
- Éxito para uno y varios pasajeros; orden de salida estable según selección.
- Rechazo de asientos repetidos, pasajeros repetidos, selección vacía y cantidades diferentes.
- Rechazo de pasajero con asiento ajeno, cédula inválida, nacimiento futuro o datos incompletos.
- Normalización consistente y rechazo de duplicados con espacios exteriores.
- Rechazo de listas dispersas y elementos nulos, sin omisiones silenciosas.
- Cédula repetida en asientos distintos no añade una prohibición inventada.
- Inmutabilidad y ausencia de mutaciones aun cuando falla el último pasajero.

## Verificación y entrega
Lint, formato y npm test con resultados reales. Mantener intactas las pruebas anteriores. El fallo de integración por entorno se reporta y no convierte esta tarea en funcionalidad completa de reservas.

Mensaje previsto: `feat(reservas): valida un pasajero por asiento seleccionado`.

## Defecto inducido
No aplica.

## Resultado de la tarea — 25 de octubre de 2026
Implementada y verificada como dominio puro, pendiente de revisión humana. 38 pruebas nuevas; 406 pruebas unitarias aprobadas en total. Lint, formato de producción y de pruebas nuevas aprobados. npm test completo sigue fallido: 4 HTTP aprobadas y 77 pruebas de integración fallidas por falta de URL/base PostgreSQL; motor Docker no disponible. No se modificaron pruebas existentes, tablas, migraciones, dependencias ni endpoints. La selección real y el bloqueo transaccional siguen siendo responsabilidad del caso de uso futuro.
