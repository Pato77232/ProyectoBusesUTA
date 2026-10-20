# BOOK-01: Plan y contratos de reservas

- **ID local:** BOOK-01
- **Responsable:** Leslie
- **Revisor habitual:** Edwin
- **Módulo:** bookings
- **Estado:** Documentada; implementación por tareas autorizada por Leslie. Las preguntas de negocio siguen abiertas.
- **Origen:** división de trabajo facilitada por Leslie el 20 de octubre de 2026.
- **Rama:** feature/BOOK-01-especificaciones-reservas

## 1. Objetivo
Dividir reservas en entregas verificables, sin inventar decisiones de otros módulos.

## 2. Reglas
RN-02, RN-12, RN-40 a RN-43, RN-50, RN-51 y RN-54. Aplican architecture.md, conventions.md y errores-inducidos.md.

## 3. Alcance
Crear BOOK-01 a BOOK-08, registrar dependencias, estrategia de ramas y criterios de revisión. No implementar pagos, boletos, viajes ni flota dentro de bookings.

## 4. Secuencia y tareas pequeñas
| Spec | Tareas y resultado | Dependencias |
|---|---|---|
| BOOK-02 | T1 dominio de disponibilidad por tramo; T2 caso de uso y adaptadores; T3 HTTP; T4 pantalla de asientos | T1 independiente; resto: contratos reales de viaje y plantilla |
| BOOK-03 | T1 dominio de reserva; T2 migración y bloqueo transaccional; T3 caso de uso; T4 HTTP y aceptación de resumen | BOOK-02, BOOK-04, BOOK-05; identidad del comprador |
| BOOK-04 | T1 cédula obligatoria por pasajero; T2 asociación persistida; T3 formulario | T1 independiente; resto: BOOK-03 y validación acordada |
| BOOK-05 | T1 política aprobada; T2 cálculo; T3 desglose visual | Tarifas de David; porcentajes y acreditación aprobados |
| BOOK-06 | T1 política pura de plazo; T2 expiración atómica; T3 ejecución periódica y aviso visual | T1 independiente; resto: BOOK-03 y protocolo de comprobantes |
| BOOK-07 | T1 contrato con pagos; T2 confirmación idempotente; T3 pruebas de carreras | Shirley y BOOK-03/06 |
| BOOK-08 | T1 consulta autorizada; T2 pantallas integradas; T3 recorrido de aceptación | Contratos de autenticación/invitado y tareas anteriores |

El orden de construcción puede adelantar tareas independientes. Cada tarea termina con su evidencia y commit; no se presenta una spec completa si solo está terminada T1.

## 5. Contratos por cerrar
- Edwin: plantilla, identificador estable del asiento y pertenencia al bus del viaje.
- David: viaje real (no frecuencia), fecha, cooperativa, ruta ordenada, bus, disponibilidad comercial y tarifas por tramo.
- Shirley: notificación autenticada de comprobante recibido, aprobación y rechazo; carreras con el vencimiento, reintentos y atomicidad de venta.
- Equipo: porcentajes, edades y acreditación de descuentos; validación de cédula; datos y recuperación de compra de invitado; tarjeta; efecto del rechazo y plazo de revisión.

Los puertos internos de bookings se diseñarán sin importar capas internas ajenas. Un repositorio simulado sirve en pruebas, nunca como fuente de disponibilidad de producción. No crear tablas espejo de viajes ni presentar una frecuencia como viaje.

## 6. Endpoints y datos
BOOK-01 no añade endpoints ni esquema. Los contratos HTTP propuestos en las demás specs no se publican hasta cerrar identidad, propiedad y fuentes reales. El servidor determina cooperativa, precio y comprador; no confía en esos valores del cuerpo.

## 7. Criterios de aceptación
- [ ] Las ocho specs identifican responsable, tareas, dependencias y aceptación.
- [ ] Las decisiones pendientes están visibles, sin porcentajes ni credenciales inventados.
- [ ] La selección y el resumen no bloquean: el bloqueo ocurre al aceptar el resumen.
- [ ] Cada tarea de implementación tiene pruebas y evidencia real.

## 8. Ramas, commits y pull requests
- Rama por tarea: feature/BOOK-02-T1-disponibilidad-dominio, feature/BOOK-04-T1-pasajeros-dominio y feature/BOOK-06-T1-plazo-reserva para los primeros incrementos independientes del entorno.
- Mientras la base documental no se integre, los incrementos pueden depender de su rama. Registrar siempre la base; no mezclar trabajo ajeno. Si se apilan ramas, revisar cada PR contra su rama padre y cambiar el destino a develop cuando corresponda con intervención humana.
- Mensajes: tipo en inglés, alcance y descripción en español, imperativo; pie Refs: docs/specs/BOOK-XX.md. Leslie autorizó hacer commits después de cada tarea; usar su identidad Git configurada.
- Recomendar primero PR documental a develop; después PR por incremento probado. Edwin revisa a Leslie. No ejecutar push, merge, rebase ni tags: AGENTS.md mantiene esas operaciones fuera del trabajo del agente.

## 9. Pruebas y evidencia
En cada tarea ejecutar npm run lint y npm test. Añadir pruebas significativas de las reglas nuevas; no cambiar pruebas ajenas. Ejecutar formato de archivos nuevos. Si no hay base de pruebas o Docker, registrar la limitación y el resultado fallido de integración; no usar una base existente ni rebajar las pruebas. Un commit local conserva trabajo pero no acredita integración aprobada.

## 10. Preguntas abiertas
Las enumeradas en §5. Bloquean únicamente las tareas afectadas; las políticas de dominio ya definidas pueden avanzar aisladas.

## 11. Defecto inducido
No aplica. No se introduce ningún defecto académico.
