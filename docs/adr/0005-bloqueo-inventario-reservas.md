# ADR 0005: bloqueo transaccional de inventario por viaje

Fecha: 28 de octubre de 2026. Estado: propuesta aplicada localmente en BOOK-03 T2, pendiente de revisión humana. Leslie autorizó seleccionar el contrato técnico de reservas conforme a la delegación que transmite de David y Edwin.

## Decisión
Usar una fila de bloqueo por (cooperative_id, trip_id), creada de forma segura y bloqueada con SELECT FOR UPDATE dentro de la transacción de reserva. Todas las ocupaciones de la solicitud se validan y escriben en esa transacción. Se reutiliza el dominio para detectar solapamiento semiabierto. No se usan extensiones nuevas ni una unicidad simple que bloquearía también tramos adyacentes.

## Consecuencias
Las escrituras de un viaje se serializan, lo que reduce concurrencia frente a un bloqueo por asiento pero simplifica orden y evita deadlocks entre solicitudes multiasiento. Las lecturas informativas siguen libres. El protocolo protege a los escritores que lo usan, no a SQL arbitrario que lo omita; no es una restricción universal de exclusión. Todo escritor futuro debe adoptar el mismo protocolo. Pruebas contra PostgreSQL comprobarán espera y rollback.

Trip, Seat y propietario se referencian por IDs públicos opacos de texto para no acoplarse a tablas de módulos ajenos ni inventar FK de catálogos que todavía no existen. El caso de uso debe verificar su existencia y autorización mediante APIs públicas; el repositorio privado no autentica. Las FK compuestas sí protegen coherencia de las tablas propias de reservas. Este límite requiere revisión antes de exponer HTTP y no se presenta como integridad externa ya garantizada.

El futuro caso de uso vuelve a resolver contexto y hora después de adquirir el bloqueo, mediante prepare. Cambio de precios, versión del resumen, mutación del catálogo y acreditación siguen siendo responsabilidades explícitas antes de activar compra. La coordinación de recepción y expiración por reserva de BOOK-06/07 no queda resuelta por este bloqueo de inventario y no se declara implementada.
